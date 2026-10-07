// Service worker: autenticação (OAuth do Mem0 ou chave de API), envio e histórico.
import {
  MCP_URL, MCP_ISSUER, REST_ADD_URL, randomString, pkceChallenge,
  prepareExchange, exchangeKey, restBody, buildAddArgs, parseMcpResponse, toolResultText,
} from "./lib.js";

const DEFAULTS = {
  enabled: true,
  authMode: "oauth",          // "oauth" (MCP do Mem0) | "apikey" (API REST)
  userId: "",
  apiKey: "",
  mode: "manual",             // "manual" | "auto"
  sites: { chatgpt: true, gemini: true },
  appIds: { chatgpt: "chatgpt", gemini: "gemini" },
  redactSecrets: true,
  instructions: null,         // null = instrução padrão no idioma do navegador
};
const defaultInstructions = () => chrome.i18n.getMessage("defaultInstructions");
const LOG_MAX = 30;
const SENT_MAX = 500;

// ---------- Origin ----------
// O servidor MCP do Mem0 responde 403 "Invalid Origin header" a qualquer pedido com
// Origin (proteção contra DNS rebinding). O fetch do service worker sempre manda
// Origin: chrome-extension://<id>, e o fetch não deixa remover; então uma regra de
// sessão do declarativeNetRequest tira o Origin só dos pedidos sem aba (a própria
// extensão) para mcp.mem0.ai.
const STRIP_ORIGIN_RULE = 1;
async function ensureOriginRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [STRIP_ORIGIN_RULE],
    addRules: [{
      id: STRIP_ORIGIN_RULE, priority: 1,
      action: { type: "modifyHeaders", requestHeaders: [{ header: "origin", operation: "remove" }] },
      condition: { requestDomains: ["mcp.mem0.ai"], tabIds: [chrome.tabs.TAB_ID_NONE],
        resourceTypes: ["xmlhttprequest", "other"] },
    }],
  });
}
const originReady = ensureOriginRule().catch((e) => console.warn("regra de Origin:", e));

// ---------- armazenamento ----------
async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = settings || {};
  return { ...DEFAULTS, ...s,
    instructions: typeof s.instructions === "string" ? s.instructions : defaultInstructions(),
    sites: { ...DEFAULTS.sites, ...(s.sites || {}) },
    appIds: { ...DEFAULTS.appIds, ...(s.appIds || {}) } };
}
async function setSettings(patch) {
  const s = await getSettings();
  await chrome.storage.local.set({ settings: { ...s, ...patch } });
}
async function getAuth() { return (await chrome.storage.local.get("auth")).auth || null; }
async function setAuth(a) { await chrome.storage.local.set({ auth: a }); }

async function addLog(entry) {
  const { log = [] } = await chrome.storage.local.get("log");
  log.unshift({ at: new Date().toISOString(), ...entry });
  await chrome.storage.local.set({ log: log.slice(0, LOG_MAX) });
  const err = log[0].status === "error";
  chrome.action.setBadgeText({ text: err ? "!" : "" });
  if (err) chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
}

async function alreadySent(key) {
  const { sent = [] } = await chrome.storage.local.get("sent");
  return sent.includes(key);
}
async function markSent(key) {
  const { sent = [] } = await chrome.storage.local.get("sent");
  sent.unshift(key);
  await chrome.storage.local.set({ sent: sent.slice(0, SENT_MAX) });
}

// ---------- OAuth 2.1 + PKCE + registro dinâmico (servidor MCP do Mem0) ----------
async function oauthMeta() {
  const r = await fetch(new URL(".well-known/oauth-authorization-server", MCP_ISSUER));
  if (!r.ok) throw new Error(`metadados OAuth: HTTP ${r.status}`);
  return r.json();
}

async function registerClient(meta, redirectUri) {
  const r = await fetch(meta.registration_endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Mem0 Edge Bridge", redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      token_endpoint_auth_method: "none", scope: "read write",
    }),
  });
  if (!r.ok) throw new Error(`registro do cliente: HTTP ${r.status}`);
  return r.json();
}

async function tokenRequest(meta, params) {
  const r = await fetch(meta.token_endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`token: HTTP ${r.status} ${body.error || ""}`.trim());
  return body;
}

function storeTokens(auth, t) {
  return { ...auth, accessToken: t.access_token,
    refreshToken: t.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + ((t.expires_in || 3600) - 60) * 1000 };
}

async function login() {
  const meta = await oauthMeta();
  const redirectUri = chrome.identity.getRedirectURL();
  let auth = await getAuth();
  if (!auth || auth.redirectUri !== redirectUri || !auth.clientId) {
    const c = await registerClient(meta, redirectUri);
    auth = { clientId: c.client_id, redirectUri };
  }
  const verifier = randomString(48);
  const state = randomString(16);
  const url = new URL(meta.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code", client_id: auth.clientId, redirect_uri: redirectUri,
    scope: "read write", state, code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256", resource: MCP_ISSUER,
  });
  const back = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  const q = new URL(back).searchParams;
  if (q.get("error")) throw new Error(`login recusado: ${q.get("error")}`);
  if (q.get("state") !== state) throw new Error("login inválido (state não confere)");
  const t = await tokenRequest(meta, {
    grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri,
    client_id: auth.clientId, code_verifier: verifier, resource: MCP_ISSUER,
  });
  auth = storeTokens(auth, t);
  await setAuth(auth);
  await addLog({ status: "ok", site: "-", preview: "Conectado ao Mem0 (OAuth)" });
  return true;
}

async function accessToken() {
  let auth = await getAuth();
  if (!auth || !auth.accessToken) throw new Error("não conectado ao Mem0: abra as opções e clique em Conectar");
  if (Date.now() < auth.expiresAt) return auth.accessToken;
  if (!auth.refreshToken) throw new Error("sessão do Mem0 expirou: conecte de novo");
  const t = await tokenRequest(await oauthMeta(), {
    grant_type: "refresh_token", refresh_token: auth.refreshToken,
    client_id: auth.clientId, resource: MCP_ISSUER,
  });
  auth = storeTokens(auth, t);
  await setAuth(auth);
  return auth.accessToken;
}

async function logout() {
  const auth = await getAuth();
  if (auth && auth.accessToken) {
    try {
      const meta = await oauthMeta();
      if (meta.revocation_endpoint) {
        await fetch(meta.revocation_endpoint, { method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: auth.refreshToken || auth.accessToken, client_id: auth.clientId }) });
      }
    } catch { /* revogação é best-effort */ }
  }
  await setAuth(auth ? { clientId: auth.clientId, redirectUri: auth.redirectUri } : null);
}

// ---------- cliente MCP mínimo (Streamable HTTP) ----------
let rpcId = 0;
async function mcpPost(token, sessionId, payload) {
  await originReady;
  const headers = { "Content-Type": "application/json",
    Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const r = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await r.text();
  if (!r.ok && r.status !== 202) {
    // detalhe para diagnóstico: corpo e www-authenticate (ex.: insufficient_scope), sem o token
    const why = [r.headers.get("www-authenticate"), text.replace(/\s+/g, " ").slice(0, 160)].filter(Boolean).join(" | ");
    const step = payload.method || "?";
    if (r.status === 401) throw new Error(`Mem0 recusou o login (401, ${step}): conecte de novo. ${why}`);
    throw new Error(`MCP ${step}: HTTP ${r.status} ${why}`);
  }
  return { sessionId: r.headers.get("Mcp-Session-Id") || sessionId,
    msg: payload.id === undefined ? null : parseMcpResponse(r.headers.get("Content-Type"), text, payload.id) };
}

async function mcpSession() {
  const token = await accessToken();
  const init = await mcpPost(token, null, { jsonrpc: "2.0", id: ++rpcId, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "mem0-edge-bridge", version: chrome.runtime.getManifest().version } } });
  if (!init.msg || init.msg.error) throw new Error(`MCP initialize: ${JSON.stringify(init.msg && init.msg.error)}`);
  await mcpPost(token, init.sessionId, { jsonrpc: "2.0", method: "notifications/initialized" });
  const call = async (method, params) => {
    const { msg } = await mcpPost(token, init.sessionId, { jsonrpc: "2.0", id: ++rpcId, method, params });
    if (!msg) throw new Error(`MCP ${method}: sem resposta`);
    if (msg.error) throw new Error(`MCP ${method}: ${msg.error.message || JSON.stringify(msg.error)}`);
    return msg.result;
  };
  return { call };
}

async function addViaMcp(ex, settings) {
  const s = await mcpSession();
  const { tools = [] } = await s.call("tools/list", {});
  const tool = tools.find((t) => t.name === "add_memory") || tools.find((t) => /add.*memor/i.test(t.name));
  if (!tool) throw new Error("o servidor MCP do Mem0 não oferece add_memory");
  const res = await s.call("tools/call", { name: tool.name, arguments: buildAddArgs(tool.inputSchema, ex, settings) });
  const text = toolResultText(res);
  if (res.isError) throw new Error(text || "add_memory falhou");
  return text;
}

async function addViaRest(ex, settings) {
  if (!settings.apiKey) throw new Error("chave de API não configurada");
  const r = await fetch(REST_ADD_URL, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${settings.apiKey}` },
    body: JSON.stringify(restBody(ex, settings)) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Mem0: HTTP ${r.status} ${text.slice(0, 200)}`);
  return text;
}

// ---------- fluxo de envio ----------
async function save(raw, { manual }) {
  const settings = await getSettings();
  if (!settings.enabled) return { status: "skipped", reason: "pausado" };
  if (!settings.sites[raw.site]) return { status: "skipped", reason: "site desativado" };
  if (!manual && settings.mode !== "auto") return { status: "skipped", reason: "modo manual" };
  if (!settings.userId.trim()) {
    await addLog({ status: "error", site: raw.site, preview: "Configure o usuário (user_id) nas opções" });
    return { status: "error", error: "usuário não configurado" };
  }
  if (!raw.user || !raw.assistant) return { status: "skipped", reason: "conversa incompleta" };
  const ex = prepareExchange(raw, { redactSecrets: settings.redactSecrets });
  const key = exchangeKey(ex);
  if (await alreadySent(key)) return { status: "duplicate" };
  try {
    if (settings.authMode === "apikey") await addViaRest(ex, settings);
    else await addViaMcp(ex, settings);
    await markSent(key);
    await addLog({ status: "ok", site: ex.site, preview: ex.user.slice(0, 90) });
    return { status: "ok" };
  } catch (e) {
    await addLog({ status: "error", site: ex.site, preview: String(e.message || e).slice(0, 300) });
    return { status: "error", error: String(e.message || e) };
  }
}

async function testConnection() {
  const settings = await getSettings();
  if (settings.authMode === "apikey") {
    const r = await fetch("https://api.mem0.ai/v1/entities/", { headers: { Authorization: `Token ${settings.apiKey}` } });
    if (!r.ok) throw new Error(`chave recusada: HTTP ${r.status}`);
    return "Chave de API válida.";
  }
  const s = await mcpSession();
  const { tools = [] } = await s.call("tools/list", {});
  return `Conectado: ${tools.length} ferramentas do Mem0 disponíveis.`;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case "save": return save(msg.exchange, { manual: !!msg.manual });
      case "diag": await chrome.storage.session.set({ [`diag_${msg.data.site}`]: msg.data }); return { ok: true };
      case "defaultInstructions": return { text: defaultInstructions() };
      case "getDiag": return chrome.storage.session.get(["diag_chatgpt", "diag_gemini"]);
      case "getState": return { settings: await getSettings(), auth: !!(await getAuth())?.accessToken,
        log: (await chrome.storage.local.get("log")).log || [] };
      case "setSettings": await setSettings(msg.patch); return { ok: true };
      case "login": return login().then(() => ({ ok: true }));
      case "logout": await logout(); return { ok: true };
      case "test": return { ok: true, message: await testConnection() };
      case "clearLog": await chrome.storage.local.set({ log: [] }); chrome.action.setBadgeText({ text: "" }); return { ok: true };
      default: return { error: "mensagem desconhecida" };
    }
  })().then(reply, (e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

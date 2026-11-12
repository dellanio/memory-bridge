// Service worker: autenticação (OAuth do Mem0 ou chave de API), envio e histórico.
import {
  MCP_URL, MCP_ISSUER, REST_ADD_URL, randomString, pkceChallenge,
  prepareExchange, exchangeKey, restBody, buildAddArgs, parseMcpResponse, toolResultText,
  eventIdOf, eventOutcome, authErrorKind,
} from "./lib.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EVENT_WAIT_MS = 30000, EVENT_POLL_MS = 1500;

// espera o Mem0 processar o evento e devolve as memórias criadas (null = não deu tempo)
async function waitEvent(check) {
  const until = Date.now() + EVENT_WAIT_MS;
  await sleep(2000);
  while (Date.now() < until) {
    const o = eventOutcome(await check());
    if (o.done) { if (o.failed) throw new Error(`Mem0: ${o.error}`); return o.memories; }
    await sleep(EVENT_POLL_MS);
  }
  return null;
}

const DEFAULTS = {
  enabled: true,
  // "oauth" (MCP do Mem0) | "apikey-mcp" (MCP com chave de API) | "apikey" (API REST)
  authMode: "oauth",
  userId: "",
  apiKey: "",
  mode: "manual",             // "manual" | "auto"
  sites: { chatgpt: true, gemini: true },
  appIds: { chatgpt: "chatgpt", gemini: "gemini" },
  redactSecrets: true,
  instructions: null,         // null = instrução padrão no idioma escolhido
  language: "auto",           // "auto" (idioma do navegador) | "pt_BR" | "en"
};

// ---------- idioma ----------
// chrome.i18n segue só o idioma do navegador; para o usuário poder escolher, as
// mensagens de _locales são carregadas aqui e servidas às páginas e ao content script.
const LANGS = ["pt_BR", "en"];
const dictCache = {};
function resolveLang(pref) {
  if (LANGS.includes(pref)) return pref;
  return (chrome.i18n.getUILanguage() || "").toLowerCase().startsWith("pt") ? "pt_BR" : "en";
}
async function dict(lang) {
  if (!dictCache[lang]) {
    const raw = await (await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`))).json();
    dictCache[lang] = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.message]));
  }
  return dictCache[lang];
}
async function currentLang() {
  const { settings } = await chrome.storage.local.get("settings");
  return resolveLang((settings || {}).language);
}
async function T(key, ...args) {
  const d = await dict(await currentLang());
  let s = d[key] || (await dict("en"))[key] || key;
  args.forEach((a, i) => { s = s.replace(`$${i + 1}`, a); });
  return s;
}
const defaultInstructions = async (lang) => (await dict(lang || await currentLang())).defaultInstructions;
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
    instructions: typeof s.instructions === "string" ? s.instructions : await defaultInstructions(resolveLang(s.language)),
    sites: { ...DEFAULTS.sites, ...(s.sites || {}) },
    appIds: { ...DEFAULTS.appIds, ...(s.appIds || {}) } };
}
async function setSettings(patch) {
  const s = await getSettings();
  const next = { ...s, ...patch };
  // trocou o idioma e a instrução era a padrão do idioma anterior: passa a usar a do novo
  if (patch.language && resolveLang(patch.language) !== resolveLang(s.language)
      && (next.instructions || "").trim() === ((await defaultInstructions(resolveLang(s.language))) || "").trim()) {
    next.instructions = null;
  }
  await chrome.storage.local.set({ settings: next });
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
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    // 5xx = o registro dinâmico do Mem0 está fora do ar (a store de clientes caiu):
    // não adianta tentar de novo, o caminho é a chave de API.
    if (r.status >= 500) throw new Error(await T("errDcrUnavailable", r.status));
    const why = (body && (body.error_description || body.error)) || `HTTP ${r.status}`;
    throw new Error(`registro do cliente: ${why}`);
  }
  return body;
}

// O Mem0 guarda o cliente registrado em memória/banco que pode ser recriado a cada
// deploy. Quando o registro some, o /token responde invalid_client e a extensão
// fica sem caminho de recuperação se não sondar antes. O probe pergunta ao servidor
// se ele ainda conhece o client_id guardado (não consome nada: o refresh_token é falso):
//   invalid_client -> o servidor não conhece mais o cliente -> refaz o registro
//   invalid_grant  -> o cliente continua válido -> só o refresh token está ruim
async function probeClient(meta, clientId) {
  try {
    const r = await fetch(meta.token_endpoint, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token", refresh_token: "probe",
        client_id: clientId, resource: MCP_ISSUER,
      }),
    });
    const body = await r.json().catch(() => ({}));
    return authErrorKind(r.status, body);
  } catch { return "unknown"; }
}

async function tokenRequest(meta, params, clientSecret) {
  const body = new URLSearchParams(params);
  if (clientSecret) body.set("client_secret", clientSecret);
  const r = await fetch(meta.token_endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const kind = authErrorKind(r.status, json);
    const desc = json.error_description || "";
    const err = new Error(`token: HTTP ${r.status} ${json.error || ""}${desc ? ` (${desc})` : ""}`.trim());
    err.kind = kind;
    throw err;
  }
  return json;
}

function storeTokens(auth, t) {
  return { ...auth, accessToken: t.access_token,
    refreshToken: t.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + ((t.expires_in || 3600) - 60) * 1000 };
}

async function login({ force = false } = {}) {
  const meta = await oauthMeta();
  const redirectUri = chrome.identity.getRedirectURL();
  let auth = await getAuth();
  if (auth && auth.clientId && !force && auth.redirectUri === redirectUri) {
    // o registro do cliente pode ter sumido no servidor: confere antes de usar
    if (await probeClient(meta, auth.clientId) === "client_invalid") auth = null;
  }
  if (!auth || !auth.clientId || auth.redirectUri !== redirectUri) {
    const c = await registerClient(meta, redirectUri);
    auth = { clientId: c.client_id, clientSecret: c.client_secret || null, redirectUri };
    // guarda o cliente novo já: se o usuário cancelar o navegador, o registro não se perde
    await setAuth(auth);
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
  if (q.get("error")) throw new Error(await T("errLoginRefused", q.get("error")));
  if (q.get("state") !== state) throw new Error(await T("errLoginInvalid"));
  const params = {
    grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri,
    client_id: auth.clientId, code_verifier: verifier, resource: MCP_ISSUER,
  };
  let t;
  try {
    t = await tokenRequest(meta, params, auth.clientSecret);
  } catch (e) {
    if (e.kind !== "client_invalid") throw e;
    // o cliente morreu entre a sondagem e a troca do código: registra outro e refaz
    const c = await registerClient(meta, redirectUri);
    auth = { clientId: c.client_id, clientSecret: c.client_secret || null, redirectUri };
    await setAuth(auth);
    t = await tokenRequest(meta, { ...params, client_id: auth.clientId }, auth.clientSecret);
  }
  auth = storeTokens(auth, t);
  await setAuth(auth);
  await addLog({ status: "ok", site: "-", preview: await T("logConnected") });
  return true;
}

async function accessToken() {
  let auth = await getAuth();
  if (!auth || !auth.accessToken) throw new Error(await T("errNotConnected"));
  if (Date.now() < auth.expiresAt) return auth.accessToken;
  if (!auth.refreshToken) throw new Error(await T("errSessionExpired"));
  let t;
  try {
    t = await tokenRequest(await oauthMeta(), {
      grant_type: "refresh_token", refresh_token: auth.refreshToken,
      client_id: auth.clientId, resource: MCP_ISSUER,
    }, auth.clientSecret);
  } catch (e) {
    if (e.kind === "client_invalid") {
      // o Mem0 não conhece mais este cliente: joga o login fora (o próximo "Conectar"
      // registra um cliente novo) e diz o que fazer
      await setAuth({ clientId: auth.clientId, redirectUri: auth.redirectUri });
      throw new Error(await T("errClientInvalid"));
    }
    throw e;
  }
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
// O header Authorization pode ser "Bearer <token OAuth>" ou "Token <chave de API>":
// o servidor MCP do Mem0 aceita os dois (a chave começa com m0-).
let rpcId = 0;
async function mcpPost(authHeader, sessionId, payload) {
  await originReady;
  const headers = { "Content-Type": "application/json",
    Accept: "application/json, text/event-stream", Authorization: authHeader };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const r = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await r.text();
  if (!r.ok && r.status !== 202) {
    // detalhe para diagnóstico: corpo e www-authenticate (ex.: insufficient_scope), sem o token
    const why = [r.headers.get("www-authenticate"), text.replace(/\s+/g, " ").slice(0, 160)].filter(Boolean).join(" | ");
    const step = payload.method || "?";
    if (r.status === 401) throw new Error(`${await T("errUnauthorized")} (401, ${step}) ${why}`);
    throw new Error(`MCP ${step}: HTTP ${r.status} ${why}`);
  }
  return { sessionId: r.headers.get("Mcp-Session-Id") || sessionId,
    msg: payload.id === undefined ? null : parseMcpResponse(r.headers.get("Content-Type"), text, payload.id) };
}

async function mcpSession(authHeader) {
  const init = await mcpPost(authHeader, null, { jsonrpc: "2.0", id: ++rpcId, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "mem0-edge-bridge", version: chrome.runtime.getManifest().version } } });
  if (!init.msg || init.msg.error) throw new Error(`MCP initialize: ${JSON.stringify(init.msg && init.msg.error)}`);
  await mcpPost(authHeader, init.sessionId, { jsonrpc: "2.0", method: "notifications/initialized" });
  const call = async (method, params) => {
    const { msg } = await mcpPost(authHeader, init.sessionId, { jsonrpc: "2.0", id: ++rpcId, method, params });
    if (!msg) throw new Error(`MCP ${method}: sem resposta`);
    if (msg.error) throw new Error(`MCP ${method}: ${msg.error.message || JSON.stringify(msg.error)}`);
    return msg.result;
  };
  return { call };
}

// sessão MCP com a chave de API do Mem0 (sem OAuth): o próprio endpoint MCP aceita
// "Authorization: Token m0-..." e devolve as mesmas ferramentas add_memory/get_event_status.
async function mcpSessionWithKey(settings) {
  if (!settings.apiKey) throw new Error(await T("errNoApiKey"));
  try {
    return await mcpSession(`Token ${settings.apiKey}`);
  } catch (e) {
    if (/401|invalid|api key/i.test(String(e.message || e))) {
      throw new Error(`${await T("errKeyRefused")}: ${String(e.message || e).slice(0, 160)}`);
    }
    throw e;
  }
}

async function addMemoryViaMcp(session, ex, settings) {
  const { tools = [] } = await session.call("tools/list", {});
  const tool = tools.find((t) => t.name === "add_memory") || tools.find((t) => /add.*memor/i.test(t.name));
  if (!tool) throw new Error("o servidor MCP do Mem0 não oferece add_memory");
  const res = await session.call("tools/call", { name: tool.name, arguments: buildAddArgs(tool.inputSchema, ex, settings) });
  const text = toolResultText(res);
  if (res.isError) throw new Error(text || "add_memory falhou");
  const id = eventIdOf(res);
  if (!id || !tools.some((t) => t.name === "get_event_status")) return null;
  return waitEvent(async () => session.call("tools/call", { name: "get_event_status", arguments: { event_id: id } }));
}

async function addViaMcp(ex, settings) {
  return addMemoryViaMcp(await mcpSession(`Bearer ${await accessToken()}`), ex, settings);
}

async function addViaMcpKey(ex, settings) {
  return addMemoryViaMcp(await mcpSessionWithKey(settings), ex, settings);
}

async function addViaRest(ex, settings) {
  if (!settings.apiKey) throw new Error(await T("errNoApiKey"));
  const r = await fetch(REST_ADD_URL, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${settings.apiKey}` },
    body: JSON.stringify(restBody(ex, settings)) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Mem0: HTTP ${r.status} ${text.slice(0, 200)}`);
  const id = eventIdOf(text);
  if (!id) return null;
  return waitEvent(async () => {
    const e = await fetch(`https://api.mem0.ai/v1/event/${id}/`, { headers: { Authorization: `Token ${settings.apiKey}` } });
    return e.ok ? e.json() : null;
  });
}

// ---------- fluxo de envio ----------
async function save(raw, { manual }) {
  const settings = await getSettings();
  if (!settings.enabled) return { status: "skipped", reason: "pausado" };
  if (!settings.sites[raw.site]) return { status: "skipped", reason: "site desativado" };
  if (!manual && settings.mode !== "auto") return { status: "skipped", reason: "modo manual" };
  if (!settings.userId.trim()) {
    await addLog({ status: "error", site: raw.site, preview: await T("errNeedUserLog") });
    return { status: "error", error: await T("errNeedUserLog") };
  }
  if (!raw.user || !raw.assistant) return { status: "skipped", reason: "conversa incompleta" };
  const ex = prepareExchange(raw, { redactSecrets: settings.redactSecrets });
  const key = exchangeKey(ex);
  if (await alreadySent(key)) return { status: "duplicate" };
  try {
    let memories;
    if (settings.authMode === "apikey") memories = await addViaRest(ex, settings);
    else if (settings.authMode === "apikey-mcp") memories = await addViaMcpKey(ex, settings);
    else memories = await addViaMcp(ex, settings);
    await markSent(key);
    if (memories === null) {
      await addLog({ status: "pending", site: ex.site, preview: ex.user.slice(0, 90) });
      return { status: "pending" };
    }
    if (!memories.length) {
      await addLog({ status: "none", site: ex.site, preview: ex.user.slice(0, 90) });
      return { status: "nothing" };
    }
    await addLog({ status: "ok", site: ex.site, preview: memories.join(" · ").slice(0, 160) });
    return { status: "ok", memories };
  } catch (e) {
    await addLog({ status: "error", site: ex.site, preview: String(e.message || e).slice(0, 300) });
    return { status: "error", error: String(e.message || e) };
  }
}

async function testConnection() {
  const settings = await getSettings();
  if (settings.authMode === "apikey") {
    const r = await fetch("https://api.mem0.ai/v1/entities/", { headers: { Authorization: `Token ${settings.apiKey}` } });
    if (!r.ok) throw new Error(`${await T("errKeyRefused")}: HTTP ${r.status}`);
    return T("testKeyOk");
  }
  if (settings.authMode === "apikey-mcp") {
    const s = await mcpSessionWithKey(settings);
    const { tools = [] } = await s.call("tools/list", {});
    return T("testMcpOk", String(tools.length));
  }
  const s = await mcpSession(`Bearer ${await accessToken()}`);
  const { tools = [] } = await s.call("tools/list", {});
  return T("testMcpOk", String(tools.length));
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case "save": return save(msg.exchange, { manual: !!msg.manual });
      case "diag": await chrome.storage.session.set({ [`diag_${msg.data.site}`]: msg.data }); return { ok: true };
      case "defaultInstructions": return { text: await defaultInstructions() };
      case "i18n": { const lang = await currentLang(); return { lang, messages: await dict(lang) }; }
      case "getDiag": return chrome.storage.session.get(["diag_chatgpt", "diag_gemini"]);
      case "getState": return { settings: await getSettings(), auth: !!(await getAuth())?.accessToken,
        log: (await chrome.storage.local.get("log")).log || [] };
      case "setSettings": await setSettings(msg.patch); return { ok: true };
      case "login": return login({ force: !!msg.force }).then(() => ({ ok: true }));
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

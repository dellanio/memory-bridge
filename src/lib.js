// Funções puras (sem chrome.*), testadas com `node --test`.

export const MCP_URL = "https://mcp.mem0.ai/mcp/";
export const MCP_ISSUER = "https://mcp.mem0.ai/";
export const REST_ADD_URL = "https://api.mem0.ai/v3/memories/add/";
export const MAX_CHARS = 12000;

// ---------- PKCE ----------
export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(n = 48) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}

export async function pkceChallenge(verifier) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(d);
}

// ---------- Conteúdo ----------
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,                 // OpenAI e afins
  /\bm0-[A-Za-z0-9_-]{16,}/g,                 // Mem0
  /\bAKIA[0-9A-Z]{16}\b/g,                    // AWS
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,            // GitHub
  /\bAIza[0-9A-Za-z_-]{30,}/g,                // Google
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b\d(?:[ -]?\d){12,18}\b/g,                // possíveis números de cartão
];

export function redact(text) {
  let t = String(text || "");
  for (const re of SECRET_PATTERNS) t = t.replace(re, "[REDACTED]");
  return t;
}

export function clean(text, max = MAX_CHARS) {
  const t = String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  return t.length > max ? t.slice(0, max) + " […]" : t;
}

export function prepareExchange(ex, { redactSecrets = true } = {}) {
  const f = (s) => clean(redactSecrets ? redact(s) : s);
  return { ...ex, user: f(ex.user), assistant: f(ex.assistant) };
}

export function exchangeKey(ex) {
  // chave estável para não enviar o mesmo par duas vezes
  const s = `${ex.site}|${ex.conversationId || ""}|${ex.user}|${ex.assistant}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ":" + s.length;
}

// A instrução de extração vai como mensagem "system": o Mem0 a usa para decidir o que
// guardar (testado na API REST e no servidor MCP: ignora cálculos/saudações/perguntas
// gerais e mantém fatos sobre o usuário).
export function messagesOf(ex, instructions = "") {
  const msgs = [
    { role: "user", content: ex.user },
    { role: "assistant", content: ex.assistant },
  ];
  const i = String(instructions || "").trim();
  return i ? [{ role: "system", content: i }, ...msgs] : msgs;
}

export function metadataOf(ex) {
  return {
    source: "mem0-edge-bridge",
    site: ex.site,
    conversation_id: ex.conversationId || null,
    url: ex.url || null,
    captured_at: ex.capturedAt || new Date().toISOString(),
  };
}

export function appIdFor(ex, settings) {
  return (settings.appIds && settings.appIds[ex.site]) || ex.site;
}

// Corpo para a API REST (modo chave de API).
export function restBody(ex, settings) {
  const body = {
    messages: messagesOf(ex, settings.instructions),
    user_id: settings.userId,
    app_id: appIdFor(ex, settings),
    metadata: metadataOf(ex),
  };
  if (settings.instructions && settings.instructions.trim()) body.custom_instructions = settings.instructions.trim();
  return body;
}

// o schema pode declarar o tipo direto ou via anyOf/oneOf (ex.: array | null)
export function acceptsArray(prop) {
  if (!prop) return false;
  if (prop.type === "array" || (Array.isArray(prop.type) && prop.type.includes("array"))) return true;
  return [...(prop.anyOf || []), ...(prop.oneOf || [])].some(acceptsArray);
}

// Argumentos do tool `add_memory` montados a partir do inputSchema que o servidor
// MCP anunciar: aceita snake_case ou camelCase e `messages` ou texto.
export function buildAddArgs(schema, ex, settings) {
  const props = (schema && schema.properties) || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(props, k);
  const pick = (...ks) => ks.find(has);
  const args = {};
  const msgKey = pick("messages");
  const textKey = pick("text", "content", "memory", "data");
  if (msgKey && (acceptsArray(props[msgKey]) || !textKey)) {
    args[msgKey] = messagesOf(ex, settings.instructions);
  } else if (textKey) {
    const i = String(settings.instructions || "").trim();
    args[textKey] = (i ? `[${i}]\n\n` : "") + `User: ${ex.user}\n\nAssistant: ${ex.assistant}`;
  } else {
    args.messages = messagesOf(ex, settings.instructions);
  }
  const ciKey = pick("custom_instructions", "customInstructions");
  if (ciKey && settings.instructions) args[ciKey] = settings.instructions;
  const userKey = pick("user_id", "userId");
  if (userKey && settings.userId) args[userKey] = settings.userId;
  const appKey = pick("app_id", "appId");
  if (appKey) args[appKey] = appIdFor(ex, settings);
  const metaKey = pick("metadata");
  if (metaKey) args[metaKey] = metadataOf(ex);
  return args;
}

// ---------- MCP (Streamable HTTP) ----------
// Resposta pode vir como JSON ou como SSE ("data: {...}").
export function parseMcpResponse(contentType, body, id) {
  if ((contentType || "").includes("text/event-stream")) {
    let found = null;
    for (const block of String(body).split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      try {
        const msg = JSON.parse(data);
        if (id === undefined || msg.id === id) found = msg;
      } catch { /* evento não-JSON */ }
    }
    return found;
  }
  return body ? JSON.parse(body) : null;
}

export function toolResultText(result) {
  const parts = (result && result.content) || [];
  return parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
}

// ---------- evento assíncrono do Mem0 ----------
// add devolve {event_id, status: PENDING}; o evento termina com results = memórias criadas
// (lista vazia = o Mem0 achou que não havia nada a guardar).
export function eventIdOf(res) {
  if (!res) return null;
  if (typeof res === "string") { try { return eventIdOf(JSON.parse(res)); } catch { return null; } }
  if (res.event_id) return res.event_id;
  if (res.structuredContent) return eventIdOf(res.structuredContent);
  if (Array.isArray(res.content)) return eventIdOf(toolResultText(res));
  return null;
}

export function eventOutcome(ev) {
  if (!ev) return { done: false };
  if (typeof ev === "string") { try { ev = JSON.parse(ev); } catch { return { done: false }; } }
  if (ev.structuredContent) ev = ev.structuredContent;
  else if (Array.isArray(ev.content)) return eventOutcome(toolResultText(ev));
  const st = String(ev.status || "").toUpperCase();
  if (st === "FAILED") return { done: true, failed: true, error: ev.error || "falhou" };
  if (st !== "SUCCEEDED") return { done: false };
  const memories = (ev.results || []).filter((r) => (r.event || "ADD") !== "NONE")
    .map((r) => (r.data && r.data.memory) || r.memory).filter(Boolean);
  return { done: true, memories };
}

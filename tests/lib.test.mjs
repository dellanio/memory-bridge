// node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redact, clean, prepareExchange, exchangeKey, buildAddArgs, restBody,
  parseMcpResponse, toolResultText, pkceChallenge, b64url,
} from "../src/lib.js";

const ex = { site: "gemini", conversationId: "abc", url: "https://gemini.google.com/app/abc",
  user: "Minha cor favorita é verde", assistant: "Anotado.", capturedAt: "2026-10-07T12:00:00Z" };
const settings = { userId: "dellanio", appIds: { gemini: "gemini-pessoal" } };

test("redact oculta chaves e cartões e preserva o resto", () => {
  const s = redact("chave sk-abcdefghijklmnop1234 e m0-ABCDEFGHIJKLMNOPQRST e cartão 4111 1111 1111 1111 ok");
  assert.ok(!s.includes("sk-abc") && !s.includes("m0-ABC") && !s.includes("4111"));
  assert.ok(s.endsWith(" ok"));
});

test("clean corta texto longo e normaliza linhas", () => {
  assert.equal(clean("a\n\n\n\nb"), "a\n\nb");
  assert.ok(clean("x".repeat(20), 10).endsWith("[…]"));
});

test("exchangeKey é estável e muda com o conteúdo", () => {
  assert.equal(exchangeKey(ex), exchangeKey({ ...ex }));
  assert.notEqual(exchangeKey(ex), exchangeKey({ ...ex, assistant: "Outro" }));
});

test("buildAddArgs: schema snake_case com messages", () => {
  const schema = { properties: { messages: { type: "array" }, user_id: {}, app_id: {}, metadata: {} } };
  const a = buildAddArgs(schema, ex, settings);
  assert.equal(a.user_id, "dellanio");
  assert.equal(a.app_id, "gemini-pessoal");
  assert.equal(a.messages.length, 2);
  assert.equal(a.metadata.site, "gemini");
});

test("buildAddArgs: schema real do mcp.mem0.ai (anyOf array|null) usa messages", () => {
  const schema = { properties: {
    text: { anyOf: [{ type: "string" }, { type: "null" }] },
    messages: { anyOf: [{ type: "array", items: { type: "object" } }, { type: "null" }] },
    user_id: { anyOf: [{ type: "string" }, { type: "null" }] }, agent_id: {}, app_id: {}, run_id: {}, metadata: {}, infer: {} } };
  const a = buildAddArgs(schema, ex, settings);
  assert.equal(a.messages.length, 2);
  assert.equal(a.text, undefined);
  assert.equal(a.user_id, "dellanio");
  assert.equal(a.app_id, "gemini-pessoal");
});

test("buildAddArgs: schema camelCase só com texto", () => {
  const a = buildAddArgs({ properties: { text: {}, userId: {} } }, ex, { userId: "maria" });
  assert.equal(a.userId, "maria");
  assert.match(a.text, /^User: Minha cor/);
  assert.equal(a.messages, undefined);
});

test("buildAddArgs sem schema cai para messages", () => {
  assert.equal(buildAddArgs(undefined, ex, settings).messages.length, 2);
});

test("instrução de extração vai como mensagem system (MCP e REST)", () => {
  const s2 = { ...settings, instructions: "Só fatos sobre o usuário." };
  const schema = { properties: { messages: { anyOf: [{ type: "array" }, { type: "null" }] }, text: {}, user_id: {} } };
  const a = buildAddArgs(schema, ex, s2);
  assert.deepEqual(a.messages[0], { role: "system", content: "Só fatos sobre o usuário." });
  assert.equal(a.messages.length, 3);
  const b = restBody(ex, s2);
  assert.equal(b.messages[0].role, "system");
  assert.equal(b.custom_instructions, "Só fatos sobre o usuário.");
  assert.equal(restBody(ex, { ...settings, instructions: "" }).messages.length, 2);
  assert.equal(restBody(ex, { ...settings, instructions: "" }).custom_instructions, undefined);
});

test("restBody usa o user_id configurado", () => {
  const b = restBody(ex, settings);
  assert.equal(b.user_id, "dellanio");
  assert.equal(b.app_id, "gemini-pessoal");
});

test("prepareExchange aplica redact só quando ligado", () => {
  const raw = { ...ex, user: "token sk-abcdefghijklmnop1234" };
  assert.match(prepareExchange(raw).user, /REDACTED/);
  assert.match(prepareExchange(raw, { redactSecrets: false }).user, /sk-abc/);
});

test("parseMcpResponse lê JSON e SSE", () => {
  assert.equal(parseMcpResponse("application/json", '{"id":1,"result":{}}', 1).id, 1);
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"ok"}]}}\n\n';
  const m = parseMcpResponse("text/event-stream", sse, 2);
  assert.equal(toolResultText(m.result), "ok");
});

test("PKCE: desafio S256 do exemplo da RFC 7636", async () => {
  assert.equal(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.equal(b64url(new Uint8Array([251, 255])), "-_8");
});

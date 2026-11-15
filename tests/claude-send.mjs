// Envia uma mensagem na conversa do Claude (como o e2e-claude.mjs faz) e acompanha o log da extensão.
const PORT = Number(process.env.CDP_PORT || 9337);
const MATCH = "claude.ai";
const TEXT = process.argv[2] || "Para o teste: eu moro em Recife e prefiro reuniões pela manhã.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes(MATCH));
if (!page) { console.error("aba do Claude não encontrada"); process.exit(3); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const contexts = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.executionContextCreated") contexts.push(m.params.context);
};
await new Promise((r) => (ws.onopen = r));
const send = async (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
  const m = await Promise.race([new Promise((r) => pending.set(i, r)), sleep(20000).then(() => ({ error: { message: "timeout" } }))]);
  if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; };
const evalPage = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const callOn = async (ctx, fn) => (await send("Runtime.callFunctionOn", { functionDeclaration: fn, executionContextId: ctx, returnByValue: true, awaitPromise: true })).result.value;

await send("Runtime.enable");
await sleep(2000);
const extCtx = contexts.find((c) => c.origin && c.origin.startsWith("chrome-extension://"));

const before = await callOn(extCtx.id, "function () { return chrome.runtime.sendMessage({type:'getState'}).then(s => ((s.log||[])[0]||{}).at); }");
console.log("último log antes:", before);

const focused = await evalPage(`(() => { const t = document.querySelector('[data-testid="chat-input"]'); if (!t) return false; t.focus(); return true; })()`);
console.log("campo de texto encontrado:", focused);
if (!focused) { console.error("sem campo de texto"); process.exit(4); }

await send("Input.insertText", { text: TEXT });
await sleep(600);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
console.log("mensagem enviada:", TEXT);

for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const st = await evalPage(`(() => ({ gen: !!document.querySelector('[data-testid="assistant-message"][data-is-streaming="true"], [data-testid="transcript-row"][data-perf-row-streaming="true"]'), rows: document.querySelectorAll('[data-testid="transcript-row"]').length }))()`);
  const at = await callOn(extCtx.id, "function () { return chrome.runtime.sendMessage({type:'getState'}).then(s => ((s.log||[])[0]||{}).at); }");
  if (at && at !== before) { console.log("novo registro no log:", at); break; }
  if (i % 5 === 0) console.log(`  …aguardando (${i * 2}s) rows=${st.rows} geracao=${st.gen}`);
}
const log = await callOn(extCtx.id, "function () { return chrome.runtime.sendMessage({type:'getState'}).then(s => (s.log||[]).slice(0,3)); }");
console.log("log:", JSON.stringify(log, null, 2));
ws.close();
process.exit(0);

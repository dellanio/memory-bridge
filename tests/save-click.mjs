// Aperta o botão injetado pelo content script na aba do Claude e mostra o resultado no log.
// Usa Runtime.callFunctionOn no mundo isolado da extensão para achar o botão (shadow root)
// e Input.dispatchMouseEvent para o clique (evento de mouse real).
const PORT = Number(process.env.CDP_PORT || 9337);
const MATCH = process.argv[2] || "claude.ai";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes(MATCH));
if (!page) { console.error("aba não encontrada:", MATCH); process.exit(3); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const contexts = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.executionContextCreated") contexts.push(m.params.context);
};
await new Promise((r) => (ws.onopen = r));
const send = async (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
  const m = await Promise.race([new Promise((r) => pending.set(i, r)), sleep(12000).then(() => ({ error: { message: "timeout" } }))]);
  if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; };
const callOn = async (ctx, fn, awaitPromise = false) => {
  const r = await send("Runtime.callFunctionOn", { functionDeclaration: fn, executionContextId: ctx, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro");
  return r.result.value;
};

await send("Runtime.enable");
await sleep(2500);
const extCtx = contexts.find((c) => c.origin && c.origin.startsWith("chrome-extension://"));
if (!extCtx) { console.error("mundo isolado da extensão não encontrado"); process.exit(4); }
console.log("contexto da extensão:", extCtx.id, extCtx.name);

const rect = await send("Runtime.evaluate", {
  expression: `(() => {
    // o host do popover fica no DOM principal (o shadow root é fechado, então não dá para queryar o #b)
    const host = [...document.documentElement.children].find(e => e.tagName === 'DIV' && e.style.position === 'fixed' && e.style.bottom);
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, tag: host.tagName };
  })()`,
  returnByValue: true,
}).then((r) => r.result.value);
if (!rect) { console.error("host do botão não encontrado"); process.exit(5); }
console.log("botão:", JSON.stringify(rect));

const base = { x: Math.round(rect.x), y: Math.round(rect.y), button: "left", clickCount: 1 };
await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...base });
await sleep(150);
await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
await sleep(80);
await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
console.log("clique no botão disparado");

await sleep(9000);
const state = await callOn(extCtx.id, `function () {
  return chrome.runtime.sendMessage({ type: 'getState' }).then(s => (s.log || []).slice(0, 4));
}`, true);
console.log("log:", JSON.stringify(state, null, 2));
ws.close();
process.exit(0);

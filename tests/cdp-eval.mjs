// Auxiliar de CDP para depurar a extensão no Edge de teste (porta 9337).
//
//   node tests/cdp-eval.mjs list                              # alvos do navegador
//   node tests/cdp-eval.mjs open <url>                        # abre uma aba (ex.: options.html)
//   node tests/cdp-eval.mjs page <substring> "<expressão>"    # avalia no mundo principal da aba
//   node tests/cdp-eval.mjs ext  <substring> "<expressão>"    # avalia no mundo isolado da extensão
//
// Notas:
//  - o Edge bloqueia navegar para chrome-extension:// (ERR_BLOCKED_BY_CLIENT): use o modo "open"
//    (Target.createTarget) ou clique no ícone da extensão;
//  - no protocolo flat o `contextId` no topo é recusado: use Runtime.callFunctionOn
//    com `executionContextId` (é assim que se chega ao content script da extensão).
import { join } from "node:path";
import { homedir } from "node:os";

const PORT = Number(process.env.CDP_PORT || 9337);
const EXT = join(import.meta.dirname, "..");
const PROFILE = join(homedir(), "AppData", "Local", "mem0-edge-claude-profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mode = process.argv[2] || "list";
const arg = process.argv[3];
const expr = process.argv[4];

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    events.push(m);
  };
  const ready = new Promise((r) => (ws.onopen = r));
  const send = async (method, params = {}) => { await ready; const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
    const m = await Promise.race([new Promise((r) => pending.set(i, r)), sleep(15000).then(() => ({ error: { message: "timeout" } }))]);
    if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; };
  const evaluate = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro na expressão");
    return r.result.value; };
  return { send, evaluate, events, close: () => ws.close() };
}

async function targets() { return (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()); }

// sobe o Edge de teste se a porta não estiver respondendo
let list = [];
try { list = await targets(); } catch {
  const { spawn } = await import("node:child_process");
  spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, "--headless=new",
      "--no-first-run", "--no-default-browser-check", "--window-size=1280,900",
      `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await sleep(500); try { list = await targets(); if (list.length) break; } catch { } }
}

if (mode === "open") {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const B = cdp(ver.webSocketDebuggerUrl);
  console.log(JSON.stringify(await B.send("Target.createTarget", { url: arg })));
  B.close(); process.exit(0);
}

if (mode === "list") {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const B = cdp(ver.webSocketDebuggerUrl);
  const { targetInfos } = await B.send("Target.getTargets", {});
  console.log(JSON.stringify(targetInfos.map((t) => ({ type: t.type, url: t.url })), null, 2));
  B.close(); process.exit(0);
}

const page = list.find((t) => t.type === "page" && t.url.includes(arg));
if (!page) { console.error("aba não encontrada:", arg, "\nabas:", list.map((t) => t.url).join(" | ")); process.exit(3); }
const P = cdp(page.webSocketDebuggerUrl);

if (mode === "page") {
  console.log(JSON.stringify(await P.evaluate(expr), null, 2));
  P.close(); process.exit(0);
}

if (mode === "ext") {
  await P.send("Runtime.enable");
  await sleep(2500);
  const ctx = P.events.filter((e) => e.method === "Runtime.executionContextCreated")
    .map((e) => e.params.context).find((c) => c.origin && c.origin.startsWith("chrome-extension://"));
  if (!ctx) { console.error("mundo isolado da extensão não encontrado"); P.close(); process.exit(4); }
  const r = await P.send("Runtime.callFunctionOn", {
    functionDeclaration: `function () { try { ${expr} } catch (e) { return "ERRO: " + e.message; } }`,
    executionContextId: ctx.id, awaitPromise: true, returnByValue: true,
  });
  console.log(JSON.stringify(r.result.value, null, 2));
  P.close(); process.exit(0);
}

console.error("modo desconhecido:", mode);
process.exit(2);

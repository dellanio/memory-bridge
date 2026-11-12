// Consentimento de política de dados: sem aceite, nada sai do navegador.
// 1) a página de opções mostra a divulgação e bloqueia conectar/testar
// 2) o service worker recusa o envio de memórias enquanto não houver aceite
// 3) depois do aceite, o fluxo volta a funcionar (o gate é o que muda, não o resto)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const EXT = resolve(import.meta.dirname, "..");
const PORT = 9339, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-consent-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "--lang=pt-BR", "--window-size=1280,900",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });
const list = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
function cdp(url) {
  const ws = new WebSocket(url); let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const ready = new Promise((r) => (ws.onopen = r));
  const call = (method, params = {}) => ready.then(() => new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }));
  const ev = (x) => call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }).then((r) => r.result?.result?.value);
  return { call, ev, close: () => ws.close() };
}
let ok = true;
const check = (c, l) => { console.log(`${c ? "✔" : "✖"} ${l}`); if (!c) ok = false; };
try {
  let sw;
  for (let i = 0; i < 60 && !sw; i++) { try { sw = (await list()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch {} await sleep(250); }
  const id = new URL(sw.url).host;
  const page = (await list()).find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.call("Page.enable");
  const opts = `chrome-extension://${id}/src/options.html`;
  await P.call("Page.navigate", { url: opts }); await sleep(1800);

  // 1) a divulgação aparece, marcada e com a caixa de aceite desmarcada
  check(await P.ev("!!document.getElementById('consentCard')"), "a página de opções mostra o bloco de consentimento");
  check((await P.ev("document.querySelector('#consentCard h2').textContent")).includes("Antes de começar"), "título da divulgação em português");
  check((await P.ev("document.getElementById('consent').checked")) === false, "a caixa de aceite começa desmarcada");
  check((await P.ev("document.getElementById('consentOut').textContent")).length > 0, "aviso de que nada é enviado sem o aceite");

  // 2) sem aceite, conectar é bloqueado com a mensagem de política
  await P.ev("document.getElementById('connect').click()"); await sleep(600);
  const msgTxt = await P.ev("document.getElementById('testOut').textContent");
  check(msgTxt.includes("aceitar"), `conectar sem aceite é bloqueado ("${msgTxt}")`);

  // 3) sem aceite, o service worker recusa o envio
  const semAceite = await P.ev(`(async () => {
    const r = await chrome.runtime.sendMessage({ type: "save", manual: true,
      exchange: { site: "chatgpt", user: "my favorite food is pizza", assistant: "ok", conversationId: "c1", url: "https://chatgpt.com/c/1" } });
    return r && r.status;
  })()`);
  check(semAceite === "consent", `service worker recusa o envio sem aceite (status="${semAceite}")`);

  // 4) com o aceite marcado e salvo, o gate abre (o envio passa a ser processado pelo Mem0)
  await P.ev("document.getElementById('consent').checked = true; document.getElementById('consent').dispatchEvent(new Event('change')); document.getElementById('save').click()");
  await sleep(900);
  const comAceite = await P.ev(`(async () => {
    const r = await chrome.runtime.sendMessage({ type: "save", manual: true,
      exchange: { site: "chatgpt", user: "my favorite food is pizza", assistant: "ok", conversationId: "c2", url: "https://chatgpt.com/c/2" } });
    return r && r.status;
  })()`);
  check(comAceite !== "consent", `depois do aceite o envio sai do gate (status="${comAceite}")`);
  P.close();
} catch (e) { console.error("✖ erro:", e.message); ok = false; }
finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
process.exit(ok ? 0 : 1);

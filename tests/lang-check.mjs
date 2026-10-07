// Verifica a troca de idioma: Edge em pt-BR, opções em português, troca para English (US)
// e confere opções, instrução padrão, popup e o botão no chatgpt.com.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const EXT = resolve(import.meta.dirname, "..");
const SHOT = process.argv[2];
const PORT = 9338, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-lang-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "--lang=pt-BR", "--window-size=1280,900",
  "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });
const list = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
function cdp(url) {
  const ws = new WebSocket(url); let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const ready = new Promise((r) => (ws.onopen = r));
  const call = async (method, params = {}) => { await ready; return new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); };
  const ev = async (x) => (await call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
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
  await P.call("Page.navigate", { url: opts }); await sleep(1500);
  check(await P.ev("document.querySelector('h1').textContent") === "Integração com Mem0", "padrão (navegador pt-BR): opções em português");
  const instrPt = await P.ev("document.getElementById('instructions').value");
  check(instrPt.startsWith("Extraia"), "instrução padrão em português");
  // escolhe English (US)
  await P.ev("(() => { const s = document.getElementById('language'); s.value = 'en'; s.dispatchEvent(new Event('change')); return true })()");
  await sleep(2500);
  const title = await P.ev("document.querySelector('h1').textContent");
  check(title === "Mem0 Integration", `após escolher English (US): título "${title}"`);
  check((await P.ev("document.getElementById('instructions').value")).startsWith("Extract only"), "instrução padrão trocou para inglês");
  check(await P.ev("document.getElementById('connect').textContent") === "Connect", "botões em inglês");
  check(await P.ev("document.documentElement.lang") === "en-US", "lang da página = en-US");
  if (SHOT) {
    await P.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }); await sleep(500);
    const s = await P.call("Page.captureScreenshot", { format: "png" }); writeFileSync(SHOT, Buffer.from(s.result.data, "base64"));
  }
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/popup.html` }); await sleep(1200);
  check(await P.ev("document.getElementById('opts').textContent") === "Settings", "popup em inglês");
  await P.call("Page.navigate", { url: "https://chatgpt.com/" }); await sleep(12000);
  const doc = await P.call("DOM.getDocument", { depth: -1, pierce: true });
  const find = (n) => { if (n.nodeName === "SPAN" && (n.attributes || []).includes("l")) return n; for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) { const f = find(c); if (f) return f; } return null; };
  const sp = find(doc.result.root);
  const label = sp && sp.children && sp.children[0] && sp.children[0].nodeValue;
  check(label === "Save to Mem0", `botão no chatgpt.com: "${label}"`);
  // volta para português
  await P.call("Page.navigate", { url: opts }); await sleep(1200);
  await P.ev("(() => { const s = document.getElementById('language'); s.value = 'pt_BR'; s.dispatchEvent(new Event('change')); return true })()");
  await sleep(2500);
  check(await P.ev("document.querySelector('h1').textContent") === "Integração com Mem0", "volta para Português (Brasil)");
  check((await P.ev("document.getElementById('instructions').value")).startsWith("Extraia"), "instrução padrão voltou para português");
  P.close();
} catch (e) { console.error("✖ erro:", e.message); ok = false; }
finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
process.exit(ok ? 0 : 1);

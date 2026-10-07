// Screenshot da tela de opções (Edge headless, pt-BR) e checagem do "Aguarde" ao clicar em Conectar.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const EXT = resolve(import.meta.dirname, "..");
const OUT = process.argv[2] || join(process.env.TMPDIR || tmpdir(), "mem0-edge-options.png");
const PORT = 9336, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-opt-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "--lang=pt-BR",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });
const list = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
try {
  let sw;
  for (let i = 0; i < 60 && !sw; i++) { try { sw = (await list()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch {} await sleep(250); }
  const id = new URL(sw.url).host;
  await sleep(1500);
  const page = (await list()).find((t) => t.type === "page" && t.url.includes("options.html")) || (await list()).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const call = (method, params = {}) => new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result.result.value;
  await call("Emulation.setDeviceMetricsOverride", { width: 760, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: `chrome-extension://${id}/src/options.html` });
  await sleep(1500);
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
  console.log("screenshot:", OUT);
  console.log("título:", await ev("document.querySelector('h1').textContent"));
  console.log("rodapé:", await ev("document.querySelector('footer').textContent"));
  await ev("document.getElementById('connect').click()");
  await sleep(300);
  console.log("após clicar em Conectar:", JSON.stringify(await ev("({estado: document.getElementById('authState').textContent, botaoDesabilitado: document.getElementById('connect').disabled})")));
  await call("Emulation.setDeviceMetricsOverride", { width: 340, height: 420, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: `chrome-extension://${id}/src/popup.html` });
  await sleep(1200);
  const pop = await call("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT.replace(/\.png$/, "-popup.png"), Buffer.from(pop.result.data, "base64"));
  ws.close();
} finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }

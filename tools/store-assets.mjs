// Gera as imagens da loja em store/: logo 300x300, telas 1280x800 e bloco promocional 440x280.
// Usa o Edge headless com a extensão carregada e dados de exemplo (fictícios) no armazenamento.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "store");
const LANG = process.argv[2] || "pt-BR";
mkdirSync(OUT, { recursive: true });
const svg = readFileSync(join(ROOT, "icons", "icon.svg"), "utf8");
const PORT = 9337, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-store-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", `--lang=${LANG}`,
  `--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, "about:blank"], { stdio: "ignore" });
const list = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
function cdp(url) {
  const ws = new WebSocket(url); let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const ready = new Promise((r) => (ws.onopen = r));
  const call = async (method, params = {}) => { await ready; return new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); };
  const ev = async (x) => (await call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
  return { call, ev, close: () => ws.close() };
}
const suffix = LANG.startsWith("pt") ? "pt" : "en";
const T = suffix === "pt"
  ? { tag: "Suas conversas do ChatGPT e do Gemini viram memória no Mem0", sub: "Integração com Mem0" }
  : { tag: "Turn your ChatGPT and Gemini chats into Mem0 memories", sub: "Mem0 Integration" };

try {
  let sw;
  for (let i = 0; i < 60 && !sw; i++) { try { sw = (await list()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch {} await sleep(250); }
  const id = new URL(sw.url).host;
  const S = cdp(sw.webSocketDebuggerUrl);
  const now = Date.now();
  const sample = suffix === "pt"
    ? ["Usuário torce para o Palmeiras", "Comida favorita do usuário é baião de dois", "Usuário trabalha como arquiteto de software", "Usuário prefere respostas curtas e diretas"]
    : ["User supports Palmeiras football club", "User's favorite food is baião de dois", "User works as a software architect", "User prefers short, direct answers"];
  const log = [
    { at: new Date(now - 60e3).toISOString(), status: "ok", site: "chatgpt", preview: sample[3] },
    { at: new Date(now - 6e5).toISOString(), status: "none", site: "gemini", preview: suffix === "pt" ? "Quanto é 12 vezes 12?" : "What is 12 times 12?" },
    { at: new Date(now - 9e5).toISOString(), status: "ok", site: "gemini", preview: sample[1] },
    { at: new Date(now - 2e6).toISOString(), status: "ok", site: "chatgpt", preview: sample[2] },
    { at: new Date(now - 4e6).toISOString(), status: "ok", site: "gemini", preview: sample[0] },
  ];
  await S.ev(`chrome.storage.local.set({ settings: { userId: "maria", mode: "auto", authMode: "oauth" },
    auth: { clientId: "demo", accessToken: "demo", expiresAt: ${now + 36e5} }, log: ${JSON.stringify(log)} })`);
  await sleep(500);

  const page = (await list()).find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.call("Page.enable");
  const shot = async (file, w, h) => {
    await sleep(900);
    const r = await P.call("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64")); console.log(join(OUT, file));
  };
  const size = (w, h) => P.call("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  // 1) logo 300x300
  await P.call("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await size(300, 300);
  await P.call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(`<body style="margin:0">${svg.replace("<svg ", '<svg width="300" height="300" ')}</body>`).toString("base64") });
  await shot("logo-300.png", 300, 300);
  await P.call("Emulation.setDefaultBackgroundColorOverride", {});

  // 2) tela de configurações 1280x800
  await size(1280, 800);
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/options.html` });
  await sleep(800);
  await P.ev(`(() => { const s = document.createElement("style"); s.textContent = "::-webkit-scrollbar{display:none}"; document.head.appendChild(s); return true })()`);
  await shot(`screenshot-1-options-${suffix}.png`, 1280, 800);

  // 3) popup ampliado sobre fundo da marca, 1280x800
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/popup.html` });
  await sleep(800);
  await P.ev(`(() => { const h = document.documentElement; h.style.cssText = "min-height:800px;background:linear-gradient(120deg,#2a1260,#5b2bc4 55%,#8e5cf7);display:flex;align-items:center;justify-content:center";
    document.body.style.cssText += ";zoom:1.45;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);margin:70px 0 0";
    document.querySelector("ul.log").style.maxHeight = "none";
    const cap = document.createElement("div"); cap.textContent = ${JSON.stringify(T.tag)};
    cap.style.cssText = "position:fixed;left:0;right:0;top:34px;text-align:center;color:#fff;font:700 30px system-ui,Segoe UI,sans-serif;zoom:" + (1 / 1.45);
    document.body.appendChild(cap); return true })()`);
  await shot(`screenshot-2-popup-${suffix}.png`, 1280, 800);

  // 4) bloco promocional 440x280
  await size(440, 280);
  await P.call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(`<!doctype html><meta charset="utf-8"><body style="margin:0;width:440px;height:280px;background:linear-gradient(120deg,#2a1260,#5b2bc4 55%,#8e5cf7);display:flex;align-items:center;gap:18px;padding:0 28px;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
    ${svg.replace("<svg ", '<svg width="104" height="104" style="flex:none;filter:drop-shadow(0 6px 16px rgba(0,0,0,.35))" ')}
    <div><div style="font-weight:800;font-size:27px;line-height:1.15">Memory Bridge</div><div style="opacity:.85;font-weight:600;font-size:15px;margin-top:4px">${T.sub}</div>
    <div style="font-weight:500;font-size:13.5px;line-height:1.35;margin-top:12px;opacity:.95">${T.tag}</div></div></body>`).toString("base64") });
  await shot(`promo-440x280-${suffix}.png`, 440, 280);

  // limpa os dados de exemplo
  await S.ev("chrome.storage.local.clear()");
  P.close(); S.close();
} finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }

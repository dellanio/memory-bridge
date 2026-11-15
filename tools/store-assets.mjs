// Gera as imagens da loja em store/: logo 300x300, telas 1280x800 e bloco promocional 440x280.
// Usa o Edge headless com a extensão carregada e dados de exemplo (fictícios) no armazenamento.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "store");
const LANG = process.argv[2] || "pt-BR";
// idioma -> sufixo dos arquivos, idioma da extensão, textos do bloco promocional e memórias de exemplo
const LANGS = {
  "pt-BR": { suffix: "pt", lang: "pt_BR",
    tag: "Suas conversas do ChatGPT, do Gemini e do Claude viram memória no Mem0", sub: "Integração com Mem0",
    sample: ["Usuário torce para o Palmeiras", "Comida favorita do usuário é baião de dois", "Usuário trabalha como arquiteto de software", "Usuário prefere respostas curtas e diretas"],
    q: "Quanto é 12 vezes 12?", claude: "Usuário usa Claude para revisar código" },
  "en-US": { suffix: "en", lang: "en",
    tag: "Turn your ChatGPT, Gemini and Claude chats into Mem0 memories", sub: "Mem0 Integration",
    sample: ["User supports Palmeiras football club", "User's favorite food is baião de dois", "User works as a software architect", "User prefers short, direct answers"],
    q: "What is 12 times 12?", claude: "User uses Claude to review code" },
  fr: { suffix: "fr", lang: "fr",
    tag: "Vos conversations ChatGPT, Gemini et Claude deviennent des mémoires Mem0", sub: "Intégration Mem0",
    sample: ["L’utilisateur supporte le club de football Palmeiras", "La nourriture préférée de l’utilisateur est le baião de dois", "L’utilisateur travaille comme architecte logiciel", "L’utilisateur préfère des réponses courtes et directes"],
    q: "Combien font 12 fois 12 ?", claude: "L’utilisateur utilise Claude pour relire du code" },
  "zh-CN": { suffix: "zh", lang: "zh_CN",
    tag: "让 ChatGPT、Gemini 和 Claude 的对话成为 Mem0 记忆", sub: "Mem0 集成",
    sample: ["用户支持帕尔梅拉斯足球俱乐部", "用户最喜欢的食物是 baião de dois", "用户是一名软件架构师", "用户偏好简短直接的回答"],
    q: "12 乘 12 等于多少？", claude: "用户用 Claude 审阅代码" },
};
const CONF = LANGS[LANG];
if (!CONF) {
  console.error(`idioma desconhecido: ${LANG} (use um de: ${Object.keys(LANGS).join(", ")})`);
  process.exit(1);
}
const suffix = CONF.suffix;
const T = { tag: CONF.tag, sub: CONF.sub };
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


try {
  let sw;
  for (let i = 0; i < 60 && !sw; i++) { try { sw = (await list()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch {} await sleep(250); }
  const id = new URL(sw.url).host;
  const S = cdp(sw.webSocketDebuggerUrl);
  const now = Date.now();
  const sample = CONF.sample;
  const log = [
    { at: new Date(now - 60e3).toISOString(), status: "ok", site: "chatgpt", preview: sample[3] },
    { at: new Date(now - 6e5).toISOString(), status: "none", site: "gemini", preview: CONF.q },
    { at: new Date(now - 9e5).toISOString(), status: "ok", site: "gemini", preview: sample[1] },
    { at: new Date(now - 3e5).toISOString(), status: "ok", site: "claude", preview: CONF.claude },
    { at: new Date(now - 2e6).toISOString(), status: "ok", site: "chatgpt", preview: sample[2] },
    { at: new Date(now - 4e6).toISOString(), status: "ok", site: "gemini", preview: sample[0] },
  ];
  await S.ev(`chrome.storage.local.set({ settings: { userId: "maria", mode: "auto", authMode: "oauth", language: ${JSON.stringify(CONF.lang)} },
    auth: { clientId: "demo", accessToken: "demo", expiresAt: ${now + 36e5} }, log: ${JSON.stringify(log)} })`);
  await sleep(500);

  const page = (await list()).find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.call("Page.enable");
  const shot = async (file, w, h, noClip = false) => {
    await sleep(900);
    const r = await P.call("Page.captureScreenshot", noClip
      ? { format: "png" }
      : { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64")); console.log(join(OUT, file));
  };
  const size = (w, h) => P.call("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  // 1) logo 300x300
  await P.call("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await size(300, 300);
  await P.call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(`<body style="margin:0">${svg.replace("<svg ", '<svg width="300" height="300" ')}</body>`).toString("base64") });
  await shot("logo-300.png", 300, 300);
  await P.call("Emulation.setDefaultBackgroundColorOverride", {});

  // 2) tela de configurações 1280x800 (rolada até a seção de sites, com ChatGPT, Gemini e Claude)
  await size(1280, 800);
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/options.html` });
  await sleep(800);
  await P.ev(`(() => { const s = document.createElement("style"); s.textContent = "::-webkit-scrollbar{display:none}"; document.head.appendChild(s); return true })()`);
  await P.ev(`(() => {
    const alvo = [...document.querySelectorAll('*')].find((el) =>
      el.children.length === 0 && /claude/i.test(el.textContent || '') && el.getBoundingClientRect().width > 0);
    if (alvo) alvo.scrollIntoView({ block: 'center' });
    return !!alvo;
  })()`);
  await sleep(500);
  await shot(`screenshot-1-options-${suffix}.png`, 1280, 800, true);

  // 3) popup ampliado sobre fundo da marca, 1280x800
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/popup.html` });
  await sleep(800);
  await P.ev(`(() => { const h = document.documentElement; h.style.cssText = "min-height:800px;background:linear-gradient(120deg,#2a1260,#5b2bc4 55%,#8e5cf7);display:flex;align-items:center;justify-content:center";
    document.body.style.cssText += ";zoom:1.3;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);margin:70px 0 0";
    document.querySelector("ul.log").style.maxHeight = "none";
    const cap = document.createElement("div"); cap.textContent = ${JSON.stringify(T.tag)};
    cap.style.cssText = "position:fixed;left:0;right:0;top:34px;text-align:center;color:#fff;font:700 30px system-ui,Segoe UI,sans-serif;zoom:" + (1 / 1.3);
    document.body.appendChild(cap); return true })()`);
  await shot(`screenshot-2-popup-${suffix}.png`, 1280, 800);

  // 4) bloco promocional 440x280
  await size(440, 280);
  await P.call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(`<!doctype html><meta charset="utf-8"><body style="margin:0;width:440px;height:280px;background:linear-gradient(120deg,#2a1260,#5b2bc4 55%,#8e5cf7);display:flex;align-items:center;gap:18px;padding:0 28px;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
    ${svg.replace("<svg ", '<svg width="104" height="104" style="flex:none;filter:drop-shadow(0 6px 16px rgba(0,0,0,.35))" ')}
    <div><div style="font-weight:800;font-size:27px;line-height:1.15">Memory Bridge</div><div style="opacity:.85;font-weight:600;font-size:15px;margin-top:4px">${T.sub}</div>
    <div style="font-weight:500;font-size:13.5px;line-height:1.35;margin-top:12px;opacity:.95">${T.tag}</div></div></body>`).toString("base64") });
  await shot(`promo-440x280-${suffix}.png`, 440, 280);

  // 5) bloco promocional grande 1400x560
  await size(1400, 560);
  await P.call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(`<!doctype html><meta charset="utf-8"><body style="margin:0;width:1400px;height:560px;background:linear-gradient(120deg,#2a1260,#5b2bc4 55%,#8e5cf7);display:flex;align-items:center;gap:56px;padding:0 110px;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
    ${svg.replace("<svg ", '<svg width="300" height="300" style="flex:none;filter:drop-shadow(0 14px 36px rgba(0,0,0,.4))" ')}
    <div><div style="font-weight:800;font-size:76px;line-height:1.05">Memory Bridge</div><div style="opacity:.85;font-weight:600;font-size:34px;margin-top:10px">${T.sub}</div>
    <div style="font-weight:500;font-size:30px;line-height:1.35;margin-top:30px;max-width:780px">${T.tag}</div></div></body>`).toString("base64") });
  await shot(`promo-1400x560-${suffix}.png`, 1400, 560);

  // limpa os dados de exemplo
  await S.ev("chrome.storage.local.clear()");
  P.close(); S.close();
} finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }

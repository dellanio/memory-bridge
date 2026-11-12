// Verifica o auto-recuperação do login OAuth no navegador real (Edge headless):
//  1. grava um client_id morto (o que o Mem0 descartou no servidor) + token expirado;
//  2. dispara um "save" e confere que o erro sai legível ("não reconhece mais este login")
//     e que o login morto foi limpo;
//  3. dispara um "login" e confere que a extensão registra um cliente NOVO no Mem0
//     (o client_id guardado muda) antes de abrir o navegador.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXT = resolve(import.meta.dirname, "..");
const PORT = 9339, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEAD_CLIENT = "7d60a77a-ebaf-48ae-b93c-58f4a370820d";   // registrado em 2026-10-07, já descartado
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-heal-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "--lang=pt-BR",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });

const list = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
function cdp(url) {
  const ws = new WebSocket(url); let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const ready = new Promise((r) => (ws.onopen = r));
  const call = async (method, params = {}) => { await ready; return new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); };
  const ev = async (x) => (await call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const fire = async (x) => (await call("Runtime.evaluate", { expression: x, returnByValue: true })).result?.result?.value;
  return { call, ev, fire, close: () => ws.close() };
}
let ok = true;
const check = (c, l) => { console.log(`${c ? "✔" : "✖"} ${l}`); if (!c) ok = false; };

try {
  let sw;
  for (let i = 0; i < 60 && !sw; i++) { try { sw = (await list()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch {} await sleep(250); }
  if (!sw) throw new Error("service worker da extensão não apareceu");
  const id = new URL(sw.url).host;
  // as mensagens vão de outra página da extensão: o service worker não ouve a si mesmo
  const page = (await list()).find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.call("Page.enable");
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/options.html` });
  await sleep(2000);

  // 1) estado quebrado: cliente que o servidor não conhece mais + token expirado
  await P.ev(`chrome.storage.local.set({
    auth: { clientId: "${DEAD_CLIENT}", redirectUri: "https://${id}.chromiumapp.org/",
            accessToken: "token-morto", refreshToken: "refresh-morto", expiresAt: 1 },
    settings: { enabled: true, mode: "auto", authMode: "oauth", userId: "dellanio",
                sites: { chatgpt: true, gemini: true }, appIds: { chatgpt: "chatgpt", gemini: "gemini" } }
  })`);
  await sleep(300);

  // 2) um "save" tem que falhar com mensagem legível, não com "invalid_client" cru
  const r = await P.ev(`chrome.runtime.sendMessage({ type: "save", manual: true, exchange: {
    site: "gemini", conversationId: "c1", url: "https://gemini.google.com/app/c1",
    user: "teste de cura", assistant: "resposta de teste", capturedAt: new Date().toISOString() } })`);
  const st = JSON.stringify(r || {});
  check(/não reconhece mais este login/i.test(st), `erro de save legível: ${String((r || {}).error || st).slice(0, 130)}`);
  check(!/invalid_client/.test(st), "a mensagem não vaza o erro cru do servidor");

  const after = await P.ev(`(async () => { const a = (await chrome.storage.local.get("auth")).auth || {}; const l = (await chrome.storage.local.get("log")).log || [];
    return { hasToken: !!a.accessToken, clientId: a.clientId, log: (l[0] || {}).preview || "" }; })()`);
  check(after && after.hasToken === false, "o token morto foi limpo do storage");
  check(after && after.log && !/invalid_client/.test(after.log), `log do popup legível: "${String(after.log).slice(0, 90)}"`);

  // 3) o botão "Reconectar" do popup tem que registrar um cliente NOVO no Mem0
  //    (o client_id guardado muda) — caminho real de um clique do usuário
  const before = after && after.clientId;
  await P.call("Page.navigate", { url: `chrome-extension://${id}/src/popup.html` });
  await sleep(1500);
  const hasBtn = await P.ev("!!document.getElementById('reconnect') && document.getElementById('reconnect').textContent.length > 0");
  check(!!hasBtn, "o popup tem o botão Reconectar");
  await P.ev("document.getElementById('reconnect').click()");
  await sleep(6000);
  const now = await P.ev(`(async () => (await chrome.storage.local.get("auth")).auth || {})()`);
  const changed = now && now.clientId && now.clientId !== before;
  check(!!changed, `cliente re-registrado no Mem0: ${before} -> ${now && now.clientId}`);
  if (changed) {
    const probe = await fetch("https://mcp.mem0.ai/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "probe", client_id: now.clientId, resource: "https://mcp.mem0.ai/" }),
    });
    const body = await probe.json().catch(() => ({}));
    check(body.error !== "invalid_client", `o Mem0 reconhece o cliente novo (${probe.status} ${JSON.stringify(body)})`);
  }
  P.close();
} catch (e) { console.error("✖ erro:", e.message); ok = false; }
finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
process.exit(ok ? 0 : 1);

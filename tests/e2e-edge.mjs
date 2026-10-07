// Teste E2E: Edge headless com perfil temporário + extensão descompactada, contra o chatgpt.com real (sem login).
// Uso: node tests/e2e-edge.mjs [--rest-user <user_id_teste>]   (MEM0_API_KEY no ambiente só no modo --rest-user)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const EXT = resolve(import.meta.dirname, "..");
const PORT = 9333;
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
// --rest-user <u>: envia pela API REST; --mcp-user <u>: envia pelo servidor MCP (a chave de API vale como bearer,
// o que exercita o mesmo caminho do OAuth depois do login). Ambos exigem MEM0_API_KEY no ambiente.
const restUser = arg("--rest-user") || arg("--mcp-user");
const viaMcp = !!arg("--mcp-user");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-e2e-"));

const edge = spawn(EDGE, [`--user-data-dir=${prof}`, `--remote-debugging-port=${PORT}`, process.env.E2E_HEADFUL ? "--window-position=-2400,0" : "--headless=new",
  "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  "--no-first-run", "--no-default-browser-check", "--window-size=1280,900",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "about:blank"], { stdio: "ignore" });

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); }
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (process.env.E2E_DEBUG && m.method === "Runtime.exceptionThrown") console.log("  [exceção]", JSON.stringify(m.params.exceptionDetails).slice(0, 400)); };
  const ready = new Promise((r) => (ws.onopen = r));
  const send = async (method, params = {}) => { await ready; const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
    const m = await new Promise((r) => pending.set(i, r)); if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; };
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  return { send, evaluate, close: () => ws.close() };
}

let ok = true;
const check = (cond, label) => { console.log(`${cond ? "✔" : "✖"} ${label}`); if (!cond) ok = false; };

try {
  let list;
  for (let i = 0; i < 40; i++) { try { list = await targets(); break; } catch { await sleep(250); } }
  let sw;
  for (let i = 0; i < 40 && !sw; i++) { sw = (await targets()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); if (!sw) await sleep(250); }
  check(!!sw, "extensão carregada (service worker ativo)");
  const S = cdp(sw.webSocketDebuggerUrl);
  const extId = new URL(sw.url).host;
  console.log("  redirect OAuth:", await S.evaluate("chrome.identity.getRedirectURL()"));

  if (restUser) {
    const key = JSON.stringify(process.env.MEM0_API_KEY || "");
    await S.evaluate(viaMcp
      ? `chrome.storage.local.set({settings:{authMode:"oauth",userId:${JSON.stringify(restUser)},mode:"auto"},auth:{clientId:"e2e",accessToken:${key},expiresAt:Date.now()+36e5}})`
      : `chrome.storage.local.set({settings:{authMode:"apikey",apiKey:${key},userId:${JSON.stringify(restUser)},mode:"auto"}})`);
  }

  const page = (await targets()).find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.send("Page.enable");
  if (process.env.E2E_DEBUG) await P.send("Runtime.enable");
  await P.send("Page.navigate", { url: "https://chatgpt.com/" });
  await sleep(12000);
  const box = await P.evaluate(`(() => { const t = document.querySelector('#prompt-textarea, textarea, [contenteditable=true]'); return t ? 'ok' : document.title })()`);
  check(box === "ok", `chatgpt.com abriu sem login (caixa de texto: ${box})`);
  const host = await P.evaluate(`[...document.documentElement.children].some(e => e.tagName==='DIV' && e.style.bottom==='88px' && e.style.position==='fixed')`);
  check(host, "botão da extensão injetado na página");

  // envia uma pergunta
  await P.evaluate(`(() => { const t = document.querySelector('#prompt-textarea, textarea, [contenteditable=true]'); t.focus(); return true })()`);
  await P.send("Input.insertText", { text: "Responda só com a palavra: pitanga. (teste automatizado de extensão)" });
  await sleep(500);
  const sent = await P.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b => /^(Enviar mensagem|Send message|Send prompt|Enviar prompt)$/i.test(b.getAttribute('aria-label')||'')); if (b && !b.disabled) { b.click(); return true } return false })()`);
  if (!sent) {
    await P.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await P.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  }
  let ex = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    ex = await P.evaluate(`(() => { const ts=[...document.querySelectorAll('[data-message-role], [data-message-author-role]')];
      const role=(t)=>t.dataset.messageRole||t.dataset.messageAuthorRole;
      const a=[...ts].reverse().find(t=>role(t)==='assistant'); const u=[...ts].reverse().find(t=>role(t)==='user');
      const gen=!!document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Parar" i], button[aria-label*="Interromper" i]') || !!(a && a.hasAttribute('data-message-role') && !a.hasAttribute('data-message-complete'));
      return {user: u&&u.innerText.trim(), assistant: a&&a.innerText.trim(), gen} })()`);
    if (ex.assistant && !ex.gen) break;
  }
  check(!!ex.user, `seletor da pergunta (user): ${JSON.stringify((ex.user || "").slice(0, 60))}`);
  check(!!ex.assistant, `seletor da resposta (assistant): ${JSON.stringify((ex.assistant || "").slice(0, 60))}`);
  check(!ex.gen, "detecção de fim de resposta (botão Stop sumiu)");

  if (restUser) {
    // modo auto: espera a extensão enviar sozinha
    let log = [];
    for (let i = 0; i < 20; i++) { await sleep(1500); log = (await S.evaluate("chrome.storage.local.get('log')")).log || []; if (log.length) break; }
    console.log("  log:", JSON.stringify(log.slice(0, 2)));
    check(log[0] && log[0].status === "ok", `envio automático para o Mem0 (${viaMcp ? "MCP" : "REST"}) com o user_id configurado`);
  } else {
    // modo manual sem user_id: clicar no botão deve registrar o aviso de configuração
    await sleep(4000);
    // simula o que o ChatGPT logado faz: uma camada transparente cobrindo a página com z-index máximo
    await P.evaluate(`(() => { const d=document.createElement('div'); d.id='overlay-teste'; d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:transparent'; document.body.appendChild(d); return true })()`);
    const pos = await P.evaluate(`(() => { const h=[...document.documentElement.children].find(e => e.tagName==='DIV' && e.style.bottom==='88px'); const r=h.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height, display:h.style.display, hit:(document.elementFromPoint(r.left+r.width/2, r.top+r.height/2)||{}).tagName} })()`);
    console.log("  botão:", JSON.stringify(pos));
    const doc = await P.send("DOM.getDocument", { depth: -1, pierce: true });
    const find = (n) => { if (n.nodeName === "BUTTON" && (n.attributes || []).includes("b")) return n; for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) { const f = find(c); if (f) return f; } return null; };
    const bn = find(doc.root);
    console.log("  atributos do botão:", JSON.stringify(bn && bn.attributes));
    for (const type of ["mousePressed", "mouseReleased"]) await P.send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await sleep(2000);
    const log = (await S.evaluate("chrome.storage.local.get('log')")).log || [];
    check(log[0] && /user/i.test(log[0].preview), `clique sem user_id gera aviso: ${JSON.stringify(log[0])}`);
    // diagnóstico pela aba + fallback por rótulo ("Você disse:") quando os atributos somem
    const diag = async () => { await sleep(6500); const d = await S.evaluate(`chrome.storage.session.get("diag_chatgpt")`); return (d && d.diag_chatgpt) || { erro: "sem diagnóstico" }; };
    let d1 = await diag();
    console.log("  diagnóstico:", JSON.stringify(d1));
    check(d1 && d1.popover === true && d1.userChars > 0, "diagnóstico responde e o botão está na top layer");
    await P.evaluate(`(() => { document.querySelectorAll('[data-message-role],[data-message-author-role],[data-turn]').forEach(e => { e.removeAttribute('data-message-role'); e.removeAttribute('data-message-author-role'); e.removeAttribute('data-turn') }); return true })()`);
    const d2 = await diag();
    check(d2 && d2.labelTurns >= 2 && d2.userChars > 0 && d2.assistantChars > 0, `fallback por rótulo acha a troca: ${JSON.stringify({ labelTurns: d2.labelTurns, user: d2.userStart, a: d2.assistantChars })}`);
    // variante logada 1: rótulo da resposta com outro texto ("ChatGPT 5 disse:")
    await P.evaluate(`(() => { document.querySelectorAll('h4').forEach(h => { if (/ChatGPT disse/.test(h.textContent)) h.textContent = 'ChatGPT 5 disse:' }); return true })()`);
    const d3 = await diag();
    check(d3.assistantChars > 0 && d3.roles.includes("assistant"), `rótulo "ChatGPT 5 disse:" vira resposta: ${JSON.stringify({ labels: d3.labels, roles: d3.roles, a: d3.assistantChars })}`);
    // variante logada 2: resposta sem rótulo nenhum (só "Você disse:" existe)
    await P.evaluate(`(() => { document.querySelectorAll('h4').forEach(h => { if (/disse/.test(h.textContent) && !/Você/.test(h.textContent)) h.remove() }); return true })()`);
    const d4 = await diag();
    check(d4.userChars > 0 && d4.assistantChars > 0, `sem rótulo na resposta, pega o que vem depois da pergunta: ${JSON.stringify({ labels: d4.labels, roles: d4.roles, user: d4.userStart, a: d4.assistantChars })}`);
  }
  if (process.env.E2E_SHOT) {
    const s = await P.send("Page.captureScreenshot", { format: "png" });
    (await import("node:fs")).writeFileSync(process.env.E2E_SHOT, Buffer.from(s.data, "base64"));
  }
  P.close(); S.close();
} catch (e) {
  console.error("✖ erro:", e.message); ok = false;
} finally {
  edge.kill();
  await sleep(1500);
  try { rmSync(prof, { recursive: true, force: true }); } catch { /* Edge ainda segurando arquivos */ }
}
process.exit(ok ? 0 : 1);

// Teste E2E do Claude (claude.ai) com a extensão descompactada.
//
// O Claude exige login, e a transcrição é virtualizada (só ~4 linhas montadas por vez),
// então este teste usa um PERFILO FIXO: na primeira vez ele abre o Edge visível e
// você entra no Claude; depois o mesmo perfil é reaproveitado.
//
//   node tests/e2e-claude.mjs                     # headless, usa (ou cria) o perfil fixo
//   E2E_HEADFUL=1 node tests/e2e-claude.mjs       # Edge visível (para fazer o login)
//   CLAUDE_URL=https://claude.ai/chat/<id>       # abre uma conversa específica
//   CLAUDE_SEND=1                                # envia uma pergunta de teste (cuidado!)
//
// Sem sessão logada o teste não falha: ele avisa e sai com código 0 (pulado).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const EXT = resolve(import.meta.dirname, "..");
const PORT = 9337;
// perfil fixo: guarda a sessão do Claude entre as execuções
const PROFILE = process.env.CLAUDE_PROFILE || join(homedir(), "AppData", "Local", "mem0-edge-claude-profile");
const URL_ = process.env.CLAUDE_URL || "https://claude.ai/new";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const first = !existsSync(PROFILE);

const edge = spawn(EDGE, [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`,
  process.env.E2E_HEADFUL ? "--window-position=-2400,0" : "--headless=new",
  "--no-first-run", "--no-default-browser-check", "--window-size=1280,900",
  `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, URL_], { stdio: "ignore" });

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); }
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const ready = new Promise((r) => (ws.onopen = r));
  const send = async (method, params = {}) => { await ready; const i = ++id; ws.send(JSON.stringify({ id: i, method, params }));
    const m = await new Promise((r) => pending.set(i, r)); if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; };
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  return { send, evaluate, close: () => ws.close() };
}

let ok = true;
const check = (cond, label) => { console.log(`${cond ? "✔" : "✖"} ${label}`); if (!cond) ok = false; };

try {
  let sw;
  for (let i = 0; i < 120 && !sw; i++) {
    try { sw = (await targets()).find((t) => t.type === "service_worker" && t.url.includes("src/background.js")); } catch { /* Edge subindo */ }
    if (!sw) await sleep(500);
  }
  check(!!sw, "extensão carregada (service worker ativo)");
  const S = cdp(sw.webSocketDebuggerUrl);

  const list = await targets();
  // a página do Claude (o Edge também abre a tela de opções da extensão)
  const page = list.find((t) => t.type === "page" && t.url.includes("claude.ai")) || list.find((t) => t.type === "page");
  const P = cdp(page.webSocketDebuggerUrl);
  await P.send("Page.enable");
  await sleep(first ? 8000 : 14000);

  const url = await P.evaluate("location.href");
  const loggedIn = await P.evaluate(`(() => {
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/logout')) return false;
    return !!document.querySelector('[data-testid="chat-input"], [data-testid="transcript-row"], nav a[href*="/chat/"]');
  })()`);
  if (!loggedIn) {
    const challenged = await P.evaluate(`!!document.querySelector('iframe[src*="challenges.cloudflare.com"], #challenge-form, [data-translate="checking_browser"]')`);
    console.log(`\n⟳ pulado: sem sessão do Claude no perfil ${PROFILE}`);
    if (challenged) console.log("  a página está no desafio do Cloudflare: passe ele uma vez nessa janela.");
    console.log("  Para ativar: rode com E2E_HEADFUL=1 e entre no Claude nessa janela; depois rode de novo.");
    console.log(`  (perfil: ${PROFILE})`);
    S.close(); P.close();
    process.exit(0);
  }
  console.log("  url:", url);

  // o botão da extensão entra no claude.ai
  const host = await P.evaluate(`[...document.documentElement.children].some(e => e.tagName==='DIV' && e.style.bottom==='88px' && e.style.position==='fixed')`);
  check(host, "botão da extensão injetado no claude.ai");

  // diagnóstico: o content script reconheceu o site e leu a última troca
  const diag = async () => { await sleep(6500); const d = await S.evaluate(`chrome.storage.session.get("diag_claude")`); return (d && d.diag_claude) || { erro: "sem diagnóstico" }; };
  const d = await diag();
  console.log("  diagnóstico:", JSON.stringify(d));
  check(d && d.site === "claude", "o content script casou com claude.ai");
  check(d && d.popover === true, "botão na top layer (Popover API)");
  check(d && typeof d.totalMsgs === "string" || typeof d.totalMsgs === "number" || d.totalMsgs === null,
    "diagnóstico traz o total de mensagens (transcrição virtualizada)");

  if (d && d.userChars > 0 && d.assistantChars > 0) {
    check(true, `adapter leu a última troca (usuário ${d.userChars} chars, resposta ${d.assistantChars} chars)`);
    check(d.conv && /\w{8,}/.test(d.conv), `conversationId extraído da URL: ${d.conv}`);
    check(!/^Você disse|^Claude respondeu/i.test(d.userStart || ""), "texto do usuário sem o rótulo de acessibilidade");
  } else {
    console.log("  (sem conversa aberta: abra uma conversa no Claude e rode de novo para checar a leitura)");
  }

  if (process.env.CLAUDE_SEND) {
    const sent = await P.evaluate(`(() => {
      const t = document.querySelector('[data-testid="chat-input"]'); if (!t) return false;
      t.focus(); return true; })()`);
    check(sent, "campo de texto do Claude encontrado");
    if (sent) {
      await P.send("Input.insertText", { text: process.env.CLAUDE_PROMPT || "Responda só com a palavra: pitanga. (teste automatizado)" });
      await sleep(500);
      await P.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await P.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      for (let i = 0; i < 40; i++) {
        await sleep(1500);
        const st = await P.evaluate(`(() => ({
          gen: !!document.querySelector('[data-testid="assistant-message"][data-is-streaming="true"], [data-testid="transcript-row"][data-perf-row-streaming="true"]'),
          rows: document.querySelectorAll('[data-testid="transcript-row"]').length }))()`);
        if (st.rows && !st.gen) break;
      }
      const d2 = await diag();
      console.log("  diagnóstico depois:", JSON.stringify(d2));
      check(d2 && d2.userChars > 0 && d2.assistantChars > 0, "a troca enviada também foi lida");
    }
  }
  P.close(); S.close();
} catch (e) {
  console.error("✖ erro:", e.message); ok = false;
} finally {
  // encerra a árvore inteira: senão os processos filhos ficam segurando o perfil
  // e a próxima execução não sobe (o Edge reaproveita a instância antiga).
  try { spawn("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* já morreu */ }
  await sleep(1500);
}
process.exit(ok ? 0 : 1);

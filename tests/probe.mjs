// Diagnóstico: abre uma URL no Edge headless e lista editores/turnos da página.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const url = process.argv[2] || "https://chatgpt.com/";
const PORT = 9334, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-probe-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [`--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "--window-size=1280,900",
  "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  url], { stdio: "ignore" });
try {
  let page;
  for (let i = 0; i < 40 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {} await sleep(300); }
  await sleep(Number(process.argv[3] || 15000));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let n = 100; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m) };
  const call = (method, params) => new Promise((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async (x) => (await call("Runtime.evaluate", { expression: x, returnByValue: true })).result.result.value;
  if (process.env.PROBE_SEND) {
    await ev(`document.querySelector('#prompt-textarea, textarea, [contenteditable=true]').focus()`);
    await call("Input.insertText", { text: process.env.PROBE_SEND });
    await sleep(800);
    console.log("send clicked:", await ev(`(() => { const b=[...document.querySelectorAll('button')].find(b => /enviar|send/i.test(b.getAttribute('aria-label')||'')); if(!b) return 'no button'; b.click(); return (b.getAttribute('aria-label'))+' disabled='+b.disabled })()`));
    await sleep(Number(process.env.PROBE_WAIT || 30000));
    console.log(JSON.stringify(await ev(`(() => ({
      roles: [...document.querySelectorAll('[data-message-author-role]')].map(e => e.dataset.messageAuthorRole+': '+e.innerText.slice(0,60)),
      turns: [...document.querySelectorAll('[data-turn], article, [data-testid^=conversation-turn]')].map(e => e.tagName+' turn='+(e.dataset.turn||'')+' tid='+(e.dataset.testid||'')+' : '+e.innerText.slice(0,60)),
      stop: [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label')).filter(l => /stop|parar|interromper/i.test(l||'')),
      gemini: { uq: document.querySelectorAll('user-query').length, mr: document.querySelectorAll('model-response').length,
        uqText: [...document.querySelectorAll('user-query')].map(e => (e.querySelector('.query-text')||e).innerText.slice(0,60)),
        mrText: [...document.querySelectorAll('model-response')].map(e => (e.querySelector('message-content')||e).innerText.slice(0,80)) },
      url: location.href,
      labels: [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && /^(Você disse|O ChatGPT disse|You said|ChatGPT said):?$/.test((e.textContent||'').trim())).map(e => {
        const chain=[]; let x=e; for (let i=0;i<7&&x;i++){ chain.push(x.tagName+(x.id?'#'+x.id:'')+' ['+[...x.attributes].filter(a=>a.name!=='class'&&a.name!=='style').map(a=>a.name+'='+String(a.value).slice(0,30)).join(' ')+'] txt='+JSON.stringify((x.innerText||'').slice(0,50))); x=x.parentElement }
        return chain }),
      dataAttrs: [...new Set([...document.querySelectorAll('main *, [role=main] *')].flatMap(e => [...e.attributes].map(a=>a.name)).filter(n=>n.startsWith('data-')))].slice(0,60)
      }))()`), null, 1));
  }
  const res = await new Promise((r) => { pend.set(1, r); ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { returnByValue: true, expression: `(() => ({
    title: document.title, url: location.href,
    editors: [...document.querySelectorAll('textarea,[contenteditable=true],input[type=text]')].map(e => e.tagName+'#'+e.id+'.'+String(e.className).slice(0,40)+' ph='+(e.getAttribute('placeholder')||e.getAttribute('aria-label')||'')),
    buttons: [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label')||b.innerText.trim()).filter(Boolean).slice(0,25),
    text: document.body.innerText.slice(0,600) }))()` } })); });
  console.log(JSON.stringify(res.result.result.value, null, 1));
  ws.close();
} finally { edge.kill(); await sleep(1000); try { rmSync(prof, { recursive: true, force: true }); } catch {} }

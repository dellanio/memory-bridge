// Gera icons/iconN.png a partir de icons/icon.svg usando o Edge headless (sem dependências).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dirname, "..", "icons");
const svg = readFileSync(join(DIR, "icon.svg"), "utf8");
const PORT = 9335, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "edge-icons-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  [`--user-data-dir=${prof}`, `--remote-debugging-port=${PORT}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  let page;
  for (let i = 0; i < 40 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {} await sleep(250); }
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await call("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const n of [16, 32, 48, 128]) {
    await call("Emulation.setDeviceMetricsOverride", { width: n, height: n, deviceScaleFactor: 1, mobile: false });
    const html = `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${n}" height="${n}" `)}</body></html>`;
    await call("Page.navigate", { url: "data:text/html;base64," + Buffer.from(html).toString("base64") });
    await sleep(400);
    const r = await call("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: n, height: n, scale: 1 } });
    writeFileSync(join(DIR, `icon${n}.png`), Buffer.from(r.result.data, "base64"));
    console.log(`icon${n}.png`);
  }
  ws.close();
} finally { edge.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }

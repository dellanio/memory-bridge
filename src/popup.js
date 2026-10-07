const $ = (id) => document.getElementById(id);
const msg = (m) => chrome.runtime.sendMessage(m);

async function load() {
  await window.i18nReady;
  const { settings: s, auth, log } = await msg({ type: "getState" });
  $("enabled").checked = s.enabled;
  const how = s.authMode === "apikey" ? "API key" : auth ? "OAuth ✓" : "OAuth ✗";
  $("who").textContent = s.userId ? `user_id: ${s.userId} · ${how} · ${s.mode}` : window.tr("needUser");
  const ul = $("log");
  ul.replaceChildren();
  if (!log.length) { const li = document.createElement("li"); li.className = "muted"; li.textContent = window.tr("popEmpty"); ul.append(li); }
  for (const e of log.slice(0, 12)) {
    const li = document.createElement("li");
    const time = new Date(e.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
    const mark = { error: "✗", none: "–", pending: "…" }[e.status] || "✓";
    li.className = e.status === "error" ? "err" : e.status === "none" || e.status === "pending" ? "muted" : "";
    const note = e.status === "none" ? window.tr("logNothing") + " · " : "";
    li.textContent = `${mark} ${time} · ${e.site} · ${note}${e.preview}`;
    ul.append(li);
  }
}
$("enabled").onchange = (e) => msg({ type: "setSettings", patch: { enabled: e.target.checked } });
$("opts").onclick = () => chrome.runtime.openOptionsPage();
$("diagBtn").onclick = async () => {
  const out = $("diag");
  out.hidden = false;
  const d = await msg({ type: "getDiag" });
  const items = Object.values(d || {}).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  if (!items.length) { out.textContent = window.tr("diagNoTab"); return; }
  out.textContent = items.map((r) => Object.entries(r)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n")).join("\n\n");
  navigator.clipboard?.writeText(out.textContent).catch(() => {});
};
$("clear").onclick = async () => { await msg({ type: "clearLog" }); load(); };
load();

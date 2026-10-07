const $ = (id) => document.getElementById(id);
const msg = (m) => chrome.runtime.sendMessage(m);
const t = (k) => chrome.i18n.getMessage(k);

async function load() {
  const { settings: s, auth } = await msg({ type: "getState" });
  document.querySelector(`input[name=auth][value=${s.authMode}]`).checked = true;
  document.querySelector(`input[name=mode][value=${s.mode}]`).checked = true;
  $("apiKey").value = s.apiKey || "";
  $("userId").value = s.userId || "";
  for (const k of ["chatgpt", "gemini"]) { $(`site_${k}`).checked = !!s.sites[k]; $(`app_${k}`).value = s.appIds[k] || k; }
  $("redact").checked = !!s.redactSecrets;
  $("authState").textContent = auth ? t("connected") : t("notConnected");
  $("authState").className = auth ? "ok" : "muted";
  toggle();
}

function toggle() {
  const oauth = document.querySelector("input[name=auth]:checked").value === "oauth";
  $("oauthBox").style.opacity = oauth ? 1 : 0.4;
  $("keyBox").style.display = oauth ? "none" : "";
}

function collect() {
  return {
    authMode: document.querySelector("input[name=auth]:checked").value,
    mode: document.querySelector("input[name=mode]:checked").value,
    apiKey: $("apiKey").value.trim(),
    userId: $("userId").value.trim(),
    sites: { chatgpt: $("site_chatgpt").checked, gemini: $("site_gemini").checked },
    appIds: { chatgpt: $("app_chatgpt").value.trim() || "chatgpt", gemini: $("app_gemini").value.trim() || "gemini" },
    redactSecrets: $("redact").checked,
  };
}

function show(el, r, okText) {
  el.textContent = r && r.ok !== false ? (okText || r.message || "OK") : (r && r.error) || "erro";
  el.className = r && r.ok !== false ? "ok" : "err";
}

document.querySelectorAll("input[name=auth]").forEach((e) => e.addEventListener("change", toggle));
$("save").onclick = async () => { show($("saveOut"), await msg({ type: "setSettings", patch: collect() }), t("saved")); };
$("connect").onclick = async () => {
  await msg({ type: "setSettings", patch: collect() });
  show($("testOut"), await msg({ type: "login" }), t("connected")); load();
};
$("disconnect").onclick = async () => { await msg({ type: "logout" }); load(); };
$("test").onclick = async () => {
  await msg({ type: "setSettings", patch: collect() });
  $("testOut").textContent = "…"; show($("testOut"), await msg({ type: "test" }));
};
load();

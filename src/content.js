// Content script: lê a última troca (pergunta + resposta) do ChatGPT ou do Gemini,
// mostra o botão "Salvar no Mem0" e, no modo automático, envia sozinho.
(() => {
  if (window.__mem0Bridge) return;
  window.__mem0Bridge = true;

  const txt = (el) => (el ? (el.innerText || el.textContent || "").trim() : "");
  const last = (list) => (list.length ? list[list.length - 1] : null);
  // texto da mensagem sem o rótulo de acessibilidade ("Você disse:", "ChatGPT said:")
  const LABEL_RE = /^(Você disse|O ChatGPT disse|You said|ChatGPT said|Gemini disse|Gemini said)\s*:?\s*/i;
  const msgText = (el) => {
    const label = el.querySelector("[data-message-attribution]");
    let t = txt(el);
    if (label && t.startsWith(txt(label))) t = t.slice(txt(label).length);
    return t.replace(LABEL_RE, "").trim();
  };

  const ADAPTERS = {
    chatgpt: {
      match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      conversationId: () => (location.pathname.match(/\/u?c\/([\w-]+)/) || [])[1]
        || (document.querySelector("[data-conversation-id]") || {}).dataset?.conversationId || null,
      // layout atual: li[data-message-role]; layout antigo: [data-message-author-role]
      turns: () => [...document.querySelectorAll("[data-message-role], [data-message-author-role]")]
        .map((el) => ({ el, role: el.dataset.messageRole || el.dataset.messageAuthorRole })),
      generating() {
        if (document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Parar" i], button[aria-label*="Interromper" i]')) return true;
        const a = last(this.turns().filter((t) => t.role === "assistant"));
        // o layout novo marca a resposta terminada com data-message-complete
        return !!(a && a.el.hasAttribute("data-message-role") && !a.el.hasAttribute("data-message-complete"));
      },
      lastExchange() {
        const turns = this.turns();
        let ai = -1;
        for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === "assistant") { ai = i; break; }
        let ui = -1;
        for (let i = ai - 1; i >= 0; i--) if (turns[i].role === "user") { ui = i; break; }
        if (ai < 0 || ui < 0) return null;
        // várias mensagens seguidas do assistente na mesma resposta: junta todas
        const parts = turns.slice(ui + 1).filter((t) => t.role === "assistant").map((t) => msgText(t.el));
        return { user: msgText(turns[ui].el), assistant: parts.join("\n\n") };
      },
    },
    gemini: {
      match: /(^|\.)gemini\.google\.com$/,
      conversationId: () => (location.pathname.match(/\/app\/([\w-]+)/) || [])[1] || null,
      generating: () => !!document.querySelector(
        'button[aria-label*="Stop" i], button[aria-label*="Parar" i], button[aria-label*="Interromper" i]'),
      lastExchange() {
        const u = last(document.querySelectorAll("user-query"));
        const a = last(document.querySelectorAll("model-response"));
        if (!u || !a) return null;
        const q = u.querySelector(".query-text") || u;
        const r = a.querySelector("message-content") || a.querySelector(".model-response-text") || a;
        return { user: txt(q).replace(LABEL_RE, ""), assistant: txt(r).replace(LABEL_RE, "") };
      },
    },
  };

  const site = Object.keys(ADAPTERS).find((k) => ADAPTERS[k].match.test(location.hostname));
  if (!site) return;
  const A = ADAPTERS[site];

  // ---------- botão flutuante (Shadow DOM: não herda nem quebra o CSS do site) ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:18px;bottom:88px;z-index:2147483646";
  const root = host.attachShadow({ mode: "closed" });
  // innerHTML só com literal estático (nada vindo da página ou do usuário)
  root.innerHTML = `
    <style>
      button{font:600 12px system-ui,sans-serif;border:1px solid #8884;border-radius:999px;padding:7px 12px;
        cursor:pointer;background:#1f1f1f;color:#fff;box-shadow:0 2px 8px #0004;opacity:.85}
      button:hover{opacity:1} button[disabled]{opacity:.45;cursor:default}
      .ok{background:#2e7d32}.err{background:#c62828}.busy{background:#555}
    </style>
    <button id="b" title="">Mem0</button>`;
  const btn = root.getElementById("b");
  const t = (k, fb) => (chrome.i18n && chrome.i18n.getMessage(k)) || fb;
  const LABEL = t("btnSave", "Salvar no Mem0");
  btn.textContent = LABEL;
  document.documentElement.appendChild(host);

  let lastSentKey = "";
  let settings = null;

  function flash(cls, label, ms = 2500) {
    btn.className = cls;
    btn.textContent = label;
    if (ms) setTimeout(() => { btn.className = ""; btn.textContent = LABEL; refresh(); }, ms);
  }

  function current() {
    const ex = A.lastExchange();
    if (!ex || !ex.user || !ex.assistant) return null;
    return { ...ex, site, conversationId: A.conversationId(), url: location.href,
      capturedAt: new Date().toISOString() };
  }
  const keyOf = (ex) => `${ex.conversationId}|${ex.user.length}|${ex.assistant.length}|${ex.user.slice(0, 40)}`;

  async function send(manual) {
    const ex = current();
    if (!ex) { if (manual) flash("err", t("btnNothing", "Nada para salvar")); return; }
    lastSentKey = keyOf(ex);
    flash("busy", t("btnSaving", "Salvando…"), 0);
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "save", manual, exchange: ex }); }
    catch (e) { r = { status: "error", error: String(e) }; }
    if (r.status === "ok") flash("ok", t("btnSaved", "Salvo ✓"));
    else if (r.status === "duplicate") flash("ok", t("btnAlready", "Já salvo ✓"));
    else if (r.status === "skipped") { btn.className = ""; btn.textContent = LABEL; }
    else flash("err", t("btnError", "Erro — veja o ícone"), 4000);
  }

  btn.addEventListener("click", () => send(true));

  function refresh() {
    const on = settings && settings.enabled && settings.sites[site];
    host.style.display = on ? "" : "none";
    btn.disabled = !current() || A.generating();
    btn.title = settings && settings.mode === "auto" ? t("tipAuto", "Modo automático ligado") : t("tipManual", "Clique para salvar a última troca");
  }

  // ---------- detecção de resposta concluída ----------
  let timer = null;
  let stableKey = "";
  function onChange() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      refresh();
      if (!settings || settings.mode !== "auto" || !settings.enabled || !settings.sites[site]) return;
      if (A.generating()) return;
      const ex = current();
      if (!ex) return;
      const k = keyOf(ex);
      // só envia depois de duas leituras iguais seguidas (resposta parou de crescer)
      if (k !== stableKey) { stableKey = k; onChange(); return; }
      if (k !== lastSentKey) send(false);
    }, 2500);
  }

  async function loadSettings() {
    try { settings = (await chrome.runtime.sendMessage({ type: "getState" })).settings; } catch { /* SW dormindo */ }
    refresh();
  }
  chrome.storage.onChanged.addListener((c) => { if (c.settings) loadSettings(); });
  new MutationObserver(onChange).observe(document.body, { childList: true, subtree: true, characterData: true });
  loadSettings();
})();

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
  // fallback por rótulo de acessibilidade. Logado, o rótulo da resposta pode trazer o nome
  // do modelo ("ChatGPT disse:", "O ChatGPT 5 disse:"...), então qualquer "<algo> disse:"
  // que não seja "Você disse:" conta como resposta.
  const USER_LABEL = /^(Você disse|You said)\s*:?$/i;
  const ANY_LABEL = /^(.{1,40}?)\s+(disse|said)\s*:?$/i;
  function labelEls() {
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,h6,span,div,p,strong,b,label")) {
      const s = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!s || s.length > 50 || !ANY_LABEL.test(s)) continue;
      out.push({ el, role: USER_LABEL.test(s) ? "user" : "assistant", text: s });
    }
    // rótulo pode ter filhos (<h6><span>ChatGPT</span> disse:</h6>): fica só o mais interno
    return out.filter((l) => !out.some((o) => o !== l && l.el.contains(o.el)));
  }
  // sobe do rótulo até a "caixa" da mensagem: primeiro até ter conteúdo além do rótulo,
  // depois só atravessa invólucros (pai com um único filho com texto); nunca entra num
  // ancestral que contenha outro rótulo.
  const textKids = (el) => [...el.children].filter((c) => txt(c)).length;
  function boxFor(label, all) {
    const fixed = label.closest('li, article, [role="listitem"], [data-testid^="conversation-turn"]');
    if (fixed && !all.some((o) => o !== label && fixed.contains(o))) return fixed;
    const lt = txt(label).length;
    let cur = label;
    while (cur.parentElement && cur.parentElement !== document.body) {
      const p = cur.parentElement;
      if (all.some((o) => o !== label && p.contains(o))) break;
      if (txt(cur).length > lt + 1 && textKids(p) > 1) break;
      cur = p;
    }
    return txt(cur).length > lt + 1 ? cur : label.parentElement;
  }
  function labelTurns() {
    const labels = labelEls();
    const els = labels.map((l) => l.el);
    return labels.map((l) => ({ el: boxFor(l.el, els), role: l.role })).filter((t) => t.el);
  }
  // botão de interromper a geração (aria-label em pt/en); evita casar com "Parar leitura em voz alta" etc.
  const STOP_RE = /^(stop (streaming|generating|response)|parar (transmissão|geração|de gerar|resposta)|interromper (geração|transmissão|resposta))/i;
  const stopButton = () => document.querySelector('[data-testid="stop-button"]')
    || [...document.querySelectorAll("button[aria-label]")].find((b) => STOP_RE.test(b.getAttribute("aria-label").trim()));

  const ADAPTERS = {
    chatgpt: {
      match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      conversationId: () => (location.pathname.match(/\/u?c\/([\w-]+)/) || [])[1]
        || (document.querySelector("[data-conversation-id]") || {}).dataset?.conversationId || null,
      // Vários layouts convivem: li[data-message-role] (novo), article[data-turn] e
      // [data-message-author-role] (logado/clássico). Se nenhum existir, usa os rótulos de
      // acessibilidade "Você disse:" / "O ChatGPT disse:" para achar cada mensagem.
      turns() {
        let list = [...document.querySelectorAll("[data-message-role], [data-message-author-role], [data-turn]")]
          .map((el) => ({ el, role: el.dataset.messageRole || el.dataset.messageAuthorRole || el.dataset.turn }))
          .filter((t) => t.role === "user" || t.role === "assistant");
        if (!list.length) list = labelTurns();
        // um nó pode conter outro com o mesmo papel: fica só o mais externo
        return list.filter((t, i, all) => !all.some((o, j) => j !== i && o.el !== t.el && o.el.contains(t.el)));
      },
      generating() {
        const s = stopButton();
        if (s) return "botão " + (s.getAttribute("aria-label") || s.dataset.testid);
        const a = last(this.turns().filter((t) => t.role === "assistant"));
        // o layout novo marca a resposta terminada com data-message-complete
        if (a && a.el.hasAttribute("data-message-role") && !a.el.hasAttribute("data-message-complete")) return "sem data-message-complete";
        return "";
      },
      lastExchange() {
        const turns = this.turns();
        let ai = -1;
        for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === "assistant") { ai = i; break; }
        let ui = -1;
        for (let i = ai - 1; i >= 0; i--) if (turns[i].role === "user") { ui = i; break; }
        let u = -1;
        for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === "user") { u = i; break; }
        if (u > ai) {
          // a última pergunta não tem resposta marcada: a resposta é o que vem logo depois
          // da caixa dessa pergunta (página logada sem rótulo/atributo na resposta)
          let box = turns[u].el, next = null;
          while (box && box !== document.body && !(next = box.nextElementSibling)) box = box.parentElement;
          const parts = [];
          for (let n = next; n; n = n.nextElementSibling) { const t2 = txt(n); if (t2) parts.push(t2); }
          return { user: msgText(turns[u].el), assistant: parts.join("\n\n").replace(LABEL_RE, "").trim() };
        }
        if (ui < 0) return null;
        // várias mensagens seguidas do assistente na mesma resposta: junta todas
        const parts = turns.slice(ui + 1).filter((t) => t.role === "assistant").map((t) => msgText(t.el));
        return { user: msgText(turns[ui].el), assistant: parts.filter(Boolean).join("\n\n") };
      },
    },
    gemini: {
      match: /(^|\.)gemini\.google\.com$/,
      conversationId: () => (location.pathname.match(/\/app\/([\w-]+)/) || [])[1] || null,
      turns: () => [...document.querySelectorAll("user-query, model-response")]
        .map((el) => ({ el, role: el.tagName === "USER-QUERY" ? "user" : "assistant" })),
      generating() {
        const s = stopButton();
        return s ? "botão " + s.getAttribute("aria-label") : "";
      },
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
  const t = (k, fb) => (chrome.i18n && chrome.i18n.getMessage(k)) || fb;

  // ---------- botão flutuante (Shadow DOM: não herda nem quebra o CSS do site) ----------
  const host = document.createElement("div");
  // Popover API: o botão vai para a "top layer" do navegador, acima de qualquer camada
  // do site (o ChatGPT logado cobre a página com elementos de z-index alto).
  host.style.cssText = "position:fixed;inset:auto 18px 88px auto;z-index:2147483647;margin:0;padding:0;border:0;background:transparent;overflow:visible;width:auto;height:auto";
  host.setAttribute("popover", "manual");
  const root = host.attachShadow({ mode: "closed" });
  // innerHTML só com literal estático (nada vindo da página ou do usuário)
  root.innerHTML = `
    <style>
      button{display:inline-flex;align-items:center;gap:7px;font:600 12.5px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
        border:0;border-radius:999px;padding:7px 13px 7px 8px;cursor:pointer;color:#fff;
        background:linear-gradient(135deg,#8e5cf7,#5b2bc4);box-shadow:0 4px 14px rgba(70,30,160,.35);
        opacity:.92;transition:opacity .15s,transform .15s,background .2s}
      button:hover{opacity:1;transform:translateY(-1px)}
      button.idle{opacity:.6}
      svg{width:20px;height:20px;flex:none}
      .ok{background:#2e7d32}.err{background:#c62828}.busy{background:#6b5a8e}
      /* nada a guardar: 3 piscadas de cinza claro, sem mudar o texto */
      @keyframes nada{0%,100%{filter:none}50%{background:#d9d9de;color:#55525f;box-shadow:none}}
      .nada{animation:nada .45s ease-in-out 3}
    </style>
    <button id="b" title="">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <g fill="#fff" stroke="#3b1a86" stroke-width="5" stroke-linejoin="round">
          <path d="M62 26 C52 20 40 23 37 32 C27 32 21 41 24 50 C16 55 16 68 24 73 C20 82 27 92 37 92 C40 101 52 104 62 98 Z"/>
          <path d="M66 26 C76 20 88 23 91 32 C101 32 107 41 104 50 C112 55 112 68 104 73 C108 82 101 92 91 92 C88 101 76 104 66 98 Z"/>
        </g>
        <g fill="none" stroke="#3b1a86" stroke-width="5" stroke-linecap="round">
          <path d="M37 32 C41 37 48 38 52 35"/><path d="M30 62 C37 60 43 64 45 70"/><path d="M37 92 C40 85 47 82 53 84"/>
          <path d="M91 32 C87 37 80 38 76 35"/><path d="M98 62 C91 60 85 64 83 70"/><path d="M91 92 C88 85 81 82 75 84"/>
        </g>
      </svg>
      <span id="l"></span>
    </button>`;
  const btn = root.getElementById("b");
  const lbl = root.getElementById("l");
  const LABEL = t("btnSave", "Salvar no Mem0");
  lbl.textContent = LABEL;
  document.documentElement.appendChild(host);
  const raise = () => { try { if (host.isConnected && !host.matches(":popover-open")) host.showPopover(); } catch { /* sem Popover API */ } };
  raise();

  let lastSentKey = "";
  let settings = null;
  let resetTimer = null;

  function flash(cls, label, ms = 2500) {
    clearTimeout(resetTimer);
    btn.className = cls;
    lbl.textContent = label;
    if (ms) resetTimer = setTimeout(() => { btn.className = ""; lbl.textContent = LABEL; refresh(); }, ms);
  }

  function current() {
    const ex = A.lastExchange();
    if (!ex || !ex.user || !ex.assistant) return null;
    return { ...ex, site, conversationId: A.conversationId(), url: location.href,
      capturedAt: new Date().toISOString() };
  }
  const keyOf = (ex) => `${ex.conversationId}|${ex.user.length}|${ex.assistant.length}|${ex.user.slice(0, 40)}`;

  function blinkNothing() {
    clearTimeout(resetTimer);
    btn.className = "";
    lbl.textContent = LABEL;
    void btn.offsetWidth;            // reinicia a animação se já tiver rodado
    btn.className = "nada";
    btn.title = t("tipNothing", "O Mem0 não encontrou nada para guardar nesta conversa");
    resetTimer = setTimeout(() => { btn.className = ""; refresh(); }, 1500);
  }

  // Manual: mostra "Salvando…" e o resultado. Automático: fica quieto enquanto o Mem0
  // processa e só mostra "Salvo ✓" se alguma memória foi criada; se não, 3 piscadas cinza.
  async function send(manual) {
    const ex = current();
    if (!ex) { if (manual) flash("err", t("btnNothing", "Nada para salvar — use o Diagnóstico"), 3500); return; }
    lastSentKey = keyOf(ex);
    if (manual) flash("busy", t("btnSaving", "Salvando…"), 0);
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "save", manual, exchange: ex }); }
    catch (e) { r = { status: "error", error: String(e) }; }
    if (r.status === "ok") {
      flash("ok", t("btnSaved", "Salvo ✓"));
      btn.title = (r.memories || []).join("\n");
    } else if (r.status === "nothing") blinkNothing();
    else if (r.status === "duplicate") { if (manual) flash("ok", t("btnAlready", "Já salvo ✓")); }
    else if (r.status === "pending") { if (manual) flash("busy", t("btnPending", "Enviado — o Mem0 ainda está processando"), 3000); }
    else if (r.status === "skipped") { btn.className = ""; lbl.textContent = LABEL; }
    else flash("err", t("btnError", "Erro — veja o ícone"), 4000);
  }

  btn.addEventListener("click", () => send(true));

  function refresh() {
    const on = settings && settings.enabled && settings.sites[site];
    if (!host.isConnected) document.documentElement.appendChild(host);
    host.style.display = on ? "" : "none";
    if (on) raise();
    // sempre clicável (mesmo durante a geração ou sem troca detectada): o clique mostra o motivo
    btn.classList.toggle("idle", !current());
    btn.title = settings && settings.mode === "auto" ? t("tipAuto", "Modo automático ligado") : t("tipManual", "Clique para salvar a última troca");
  }

  // ---------- detecção de resposta concluída ----------
  // Verificação periódica (não debounce de mutações: o ChatGPT logado muda o DOM o tempo
  // todo e um debounce nunca disparava). Envia quando a troca fica igual em duas leituras
  // seguidas e não há geração em andamento; se o indicador de geração ficar preso, envia
  // mesmo assim depois de ~30 s sem mudança no texto.
  const TICK = 2000, STUCK_TICKS = 15;
  let stableKey = "", stableTicks = 0;
  function tick() {
    if (document.hidden) return;
    refresh();
    if (!settings || settings.mode !== "auto" || !settings.enabled || !settings.sites[site]) return;
    const ex = current();
    if (!ex) return;
    const k = keyOf(ex);
    if (k !== stableKey) { stableKey = k; stableTicks = 0; return; }
    stableTicks++;
    if (k === lastSentKey) return;
    if (!A.generating() || stableTicks >= STUCK_TICKS) send(false);
  }
  setInterval(tick, TICK);

  // ---------- diagnóstico ----------
  // O content script publica um retrato do que enxerga (a cada ~6 s) no service worker,
  // e o popup mostra o mais recente. Empurrar daqui é mais confiável que o popup
  // perguntar à aba (tabs.sendMessage falhava com "Receiving end does not exist").
  function diagnose() {
    const turns = A.turns();
    const ex = current();
    const r = host.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      site, path: location.pathname, at: new Date().toISOString(), version: chrome.runtime.getManifest().version,
      settings: settings ? { enabled: settings.enabled, mode: settings.mode, site: settings.sites[site], userId: !!settings.userId } : null,
      turns: turns.length, roles: turns.slice(-6).map((x) => x.role).join(","),
      legacyRoles: document.querySelectorAll("[data-message-author-role]").length,
      newRoles: document.querySelectorAll("[data-message-role]").length,
      dataTurn: document.querySelectorAll("[data-turn]").length,
      labelTurns: site === "chatgpt" ? labelTurns().length : "-",
      labels: site === "chatgpt" ? [...new Set(labelEls().map((l) => l.text))].slice(0, 6).join(" | ") : "-",
      convTestIds: document.querySelectorAll('[data-testid^="conversation-turn"]').length,
      buttonTopmost: top === host ? "sim" : (top ? top.tagName.toLowerCase() + (top.id ? "#" + top.id : "") + "." + String(top.className).slice(0, 40) : "nada"),
      popover: host.matches(":popover-open"),
      generating: A.generating() || "não",
      userChars: ex ? ex.user.length : 0, assistantChars: ex ? ex.assistant.length : 0,
      userStart: ex ? ex.user.slice(0, 50) : "", stableTicks, alreadySent: !!ex && keyOf(ex) === lastSentKey,
    };
  }
  let diagTicks = 0;
  setInterval(() => {
    if (document.hidden || diagTicks++ % 3) return;
    let data;
    try { data = diagnose(); } catch (e) { data = { site, at: new Date().toISOString(), erro: String(e && e.stack || e).slice(0, 400) }; }
    chrome.runtime.sendMessage({ type: "diag", data }).catch(() => {});
  }, TICK);
  window.addEventListener("focus", () => chrome.runtime.sendMessage({ type: "diag", data: diagnose() }).catch(() => {}));

  async function loadSettings() {
    try { settings = (await chrome.runtime.sendMessage({ type: "getState" })).settings; } catch { /* SW dormindo */ }
    refresh();
  }
  chrome.storage.onChanged.addListener((c) => { if (c.settings) loadSettings(); });
  loadSettings();
})();

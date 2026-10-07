// Traduz a página com o idioma escolhido nas configurações (ou o do navegador).
// Expõe window.tr(chave) e window.i18nReady para os scripts da página.
window.tr = (k) => chrome.i18n.getMessage(k) || k;
window.i18nReady = (async () => {
  try {
    const { lang, messages } = await chrome.runtime.sendMessage({ type: "i18n" });
    window.tr = (k) => messages[k] || chrome.i18n.getMessage(k) || k;
    document.documentElement.lang = lang === "pt_BR" ? "pt-BR" : "en-US";
  } catch { /* fica com chrome.i18n */ }
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const m = window.tr(el.dataset.i18n);
    if (m) el.textContent = m;
  }
})();

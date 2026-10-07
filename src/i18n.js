// Preenche [data-i18n] com as mensagens de _locales
for (const el of document.querySelectorAll("[data-i18n]")) {
  const m = chrome.i18n.getMessage(el.dataset.i18n);
  if (m) el.textContent = m;
}

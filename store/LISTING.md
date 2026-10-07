# Ficha da loja — Microsoft Edge Add-ons

Pacote: `dist/memory-bridge-<versão>.zip` (gerado por `node tools/build-zip.mjs`).
Imagens: `store/` (geradas por `node tools/store-assets.mjs pt-BR` e `en-US`).

## Propriedades

| Campo | Valor |
|---|---|
| Categoria | Produtividade (Productivity) |
| Política de privacidade (URL) | **pendente** — publicar `PRIVACY.md` num endereço público |
| Site | https://dellanio.com |
| Contato de suporte | dellanio@gmail.com |
| Mercados | Todos |
| Conteúdo maduro | Não |

## Imagens

| Campo da loja | Arquivo |
|---|---|
| Logo da loja (300×300) | `store/logo-300.png` |
| Bloco promocional pequeno (440×280) | `store/promo-440x280-pt.png` / `-en.png` |
| Capturas de tela (1280×800) | `store/screenshot-1-options-*.png`, `store/screenshot-2-popup-*.png` |

---

## Português (Brasil)

**Descrição curta**

Salve automaticamente o que importa das suas conversas do ChatGPT e do Gemini na sua própria conta Mem0.

**Descrição**

O Memory Bridge leva as suas conversas do ChatGPT e do Gemini para a sua conta Mem0, para que as suas preferências, decisões e informações importantes fiquem disponíveis para qualquer assistente conectado ao Mem0 (Claude, ChatGPT, agentes próprios e outros).

Como funciona
• Um botão "Salvar no Mem0" aparece no chatgpt.com e no gemini.google.com.
• Modo automático: cada resposta concluída é enviada ao Mem0, que guarda só os fatos relevantes sobre você. Quando não há nada a guardar, o botão apenas pisca em cinza.
• Modo manual: só salva quando você clica.
• Filtro de memórias editável: diga ao Mem0 o que vale lembrar e o que ignorar (por padrão, ignora cálculos, saudações e perguntas pontuais).

Sua conta, seus dados
• Entre com a sua conta Mem0 (OAuth oficial do Mem0) ou use uma chave de API.
• Você escolhe o User ID com que as memórias são gravadas e o app_id de cada site.
• Chaves de API, tokens e números de cartão que aparecerem na conversa são ocultados antes do envio.
• Tudo vai direto do seu navegador para o Mem0. Não há servidor intermediário, rastreamento nem anúncios.

Requer uma conta Mem0 (https://mem0.ai). Projeto independente, sem vínculo oficial com a Mem0, a OpenAI ou o Google.

**Termos de busca** (até 7)

mem0, memória, chatgpt, gemini, ia, produtividade, contexto

---

## English

**Short description**

Automatically save what matters from your ChatGPT and Gemini chats to your own Mem0 account.

**Description**

Memory Bridge brings your ChatGPT and Gemini conversations into your Mem0 account, so your preferences, decisions and important details are available to any assistant connected to Mem0 (Claude, ChatGPT, your own agents and more).

How it works
• A "Save to Mem0" button appears on chatgpt.com and gemini.google.com.
• Automatic mode: every finished answer is sent to Mem0, which keeps only the relevant facts about you. When there is nothing worth keeping, the button just blinks grey.
• Manual mode: saves only when you click.
• Editable memory filter: tell Mem0 what to remember and what to ignore (by default it skips calculations, greetings and one-off questions).

Your account, your data
• Sign in with your Mem0 account (official Mem0 OAuth) or use an API key.
• You choose the User ID memories are saved under and the app_id for each site.
• API keys, tokens and card numbers that show up in a chat are hidden before sending.
• Everything goes straight from your browser to Mem0. No middle server, no tracking, no ads.

Requires a Mem0 account (https://mem0.ai). Independent project, not officially affiliated with Mem0, OpenAI or Google.

**Search terms**

mem0, memory, chatgpt, gemini, ai, productivity, context

---

## Notas para a certificação (Notes for certification)

The extension needs a free Mem0 account (https://app.mem0.ai) to be tested.

1. After installing, the options page opens. Click "Connect" and sign in to Mem0 (OAuth via chrome.identity.launchWebAuthFlow against https://mcp.mem0.ai). Alternatively choose "API key" and paste a Mem0 API key.
2. Fill "User ID" (any text, e.g. "tester") and click "Save".
3. Open https://chatgpt.com (works without login) and send: "My favorite food is pizza. Reply only: ok".
4. In automatic mode the "Save to Mem0" button turns green ("Saved ✓") a few seconds after the answer; the toolbar popup lists the memory created ("User's favorite food is pizza"). A question with nothing personal (e.g. "What is 12 x 12?") only makes the button blink grey.

Permissions:
- storage: settings, sign-in token and recent activity, kept only in chrome.storage.local.
- identity: OAuth sign-in to Mem0 (launchWebAuthFlow).
- declarativeNetRequestWithHostAccess: one session rule that removes the Origin header only from the extension's own requests to mcp.mem0.ai (the Mem0 MCP server rejects requests that carry an Origin header with HTTP 403).
- Host permissions https://mcp.mem0.ai/* and https://api.mem0.ai/*: the only servers the extension talks to.
- Content scripts on chatgpt.com, chat.openai.com and gemini.google.com: read the last question/answer of the open conversation and show the save button.

No remote code is loaded; all code is in the package.

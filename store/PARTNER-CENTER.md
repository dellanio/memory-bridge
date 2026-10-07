# Roteiro de publicação — Partner Center (Edge Add-ons)

Segue as etapas de https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension.
Tudo o que estiver em bloco de código é para **copiar e colar** no campo indicado.

Arquivos (pasta `D:\projetos-pessoal\mem0-edge\`):
- Pacote: `dist\memory-bridge-1.0.1.zip`
- Imagens: `store\`

---

## Etapa 1 — Preparar (já feito)

- Protótipo funcionando: ✔
- Conta de desenvolvedor: **sua parte** (Partner Center → Programas → Microsoft Edge → Introdução, conta **Individual**).
- `.zip` com o `manifest.json` na raiz: ✔ `dist\memory-bridge-1.0.1.zip`
- Campos do manifest que viram texto da loja (não editáveis no Partner Center):
  - Nome: "Memory Bridge for Mem0" / "Memory Bridge para Mem0"
  - Descrição curta: "Automatically save what matters from your ChatGPT and Gemini chats to your own Mem0 account." / "Salve automaticamente o que importa das suas conversas do ChatGPT e do Gemini na sua própria conta Mem0."

## Etapa 2 — Criar a extensão

Partner Center → **Página inicial** → cartão **Edge** → **Create new extension**.

## Etapa 3 — Enviar o pacote

Arraste `dist\memory-bridge-1.0.1.zip` → aguarde a validação → **Continue**.
O Partner Center deve listar **dois idiomas** (en e pt_BR). Se aparecer só um, ver "If a single locale appears" na página da Microsoft.

## Etapa 4 — Disponibilidade (Availability)

- Visibility: **Public**
- Markets: **todos** (padrão)
- **Save & Continue**

## Etapa 5 — Propriedades (Properties)

| Campo | Valor |
|---|---|
| Category | **Productivity** |
| Website | `https://dellanio.github.io/memory-bridge/` |
| Support contact detail | `dellanio@gmail.com` |
| Mature content | **não** marcar |

**Save & Continue**

## Etapa 6 — Privacidade (Privacy)

### Single Purpose Description

```
Saves the user's ChatGPT and Gemini conversations to the user's own Mem0 account, so the facts and preferences found in those chats become long-term memory that other Mem0-connected assistants can use. The extension adds a "Save to Mem0" button to chatgpt.com and gemini.google.com and sends the last question and answer to Mem0 when the user clicks it (or automatically, if the user turns on automatic mode).
```

### Permission justification

**storage**
```
Stores the user's settings (User ID, capture mode, enabled sites, memory-filter text, language), the Mem0 sign-in token or API key, identifiers of conversations already sent (to avoid sending duplicates) and the last 30 activity entries shown in the toolbar popup. Everything is kept in chrome.storage.local (and diagnostics in chrome.storage.session); nothing is synchronized or sent elsewhere.
```

**identity**
```
Used only for chrome.identity.launchWebAuthFlow and getRedirectURL, to let the user sign in to their Mem0 account with Mem0's official OAuth 2.1 flow (PKCE) at https://mcp.mem0.ai. No Google or Microsoft account data is read.
```

**declarativeNetRequestWithHostAccess**
```
Adds a single session rule that removes the Origin header only from the extension's own requests (tabId = none) to mcp.mem0.ai. The Mem0 MCP server rejects any request carrying an Origin header with HTTP 403 "Invalid Origin header", and fetch() in an extension service worker always adds Origin: chrome-extension://<id>. No other request, site or header is touched.
```

**Host permission: https://mcp.mem0.ai/\***
```
The official Mem0 MCP server: OAuth sign-in, token refresh and the add_memory / get_event_status calls that save the conversation and check whether a memory was created.
```

**Host permission: https://api.mem0.ai/\***
```
The official Mem0 REST API, used only when the user chooses to connect with their own Mem0 API key instead of OAuth (add memories, check the processing event, test the key).
```

**Content scripts (chatgpt.com, chat.openai.com, gemini.google.com)** — se o formulário pedir:
```
Reads the last question and the last answer of the conversation open in the tab and shows the "Save to Mem0" button. The content script runs only on these three sites and does not read other pages, cookies or form fields.
```

### Are you using remote code?

**No, I am not using remote code.**

### Data usage — What user data do you plan to collect

Marque **somente**:
- [x] **Website content** (o texto da pergunta e da resposta da conversa aberta)
- [x] **Personal communications** (as mensagens que o usuário troca com o ChatGPT/Gemini, enviadas para a conta Mem0 dele)

Não marque: identificação pessoal, saúde, finanças, autenticação, localização, histórico de navegação, atividade do usuário.

> Observação: o User ID é um texto livre escolhido pelo usuário e o token do Mem0 fica só no navegador, por isso não entram nas categorias de coleta. Se o revisor questionar, a política de privacidade descreve os dois.

### I certify that the following disclosures are true

Marque **todas** as três:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy Policy URL

```
https://dellanio.github.io/memory-bridge/privacy.html
```

**Save & Continue**

## Etapa 7 — Página da loja (Store listings), um idioma por vez

Clique **Edit details** em cada linha (English e Português).

| Campo | English | Português (Brasil) |
|---|---|---|
| Description | bloco "English → Description" do `LISTING.md` | bloco "Português → Descrição" do `LISTING.md` |
| Extension logo | `store\logo-300.png` | `store\logo-300.png` (ou **Duplicate**) |
| Small promotional tile | `store\promo-440x280-en.png` | `store\promo-440x280-pt.png` |
| Large promotional tile | `store\promo-1400x560-en.png` | `store\promo-1400x560-pt.png` |
| Screenshots | `screenshot-1-options-en.png`, `screenshot-2-popup-en.png` | `screenshot-1-options-pt.png`, `screenshot-2-popup-pt.png` |
| Search terms | `mem0`, `memory`, `chatgpt`, `gemini`, `ai memory`, `productivity`, `context` | `mem0`, `memória`, `chatgpt`, `gemini`, `memória ia`, `produtividade`, `contexto` |

Não use o botão "Generate with AI": a descrição pronta já foi revisada.
**Save draft** em cada idioma. A coluna Status deve ficar **Complete** nas duas linhas.

## Etapa 8 — Notas para certificação e envio

**Publish** (canto superior direito) → cole em **Notes for certification**:

```
The extension needs a free Mem0 account (https://app.mem0.ai) to be tested. No other account is required; chatgpt.com works without signing in.

1. After installing, the settings page opens (also available from the toolbar icon > Settings).
2. Click "Connect" and sign in to Mem0 (official Mem0 OAuth at https://mcp.mem0.ai, via chrome.identity.launchWebAuthFlow). Alternatively choose "API key (advanced)" and paste a Mem0 API key.
3. Type any "User ID" (for example: tester), choose "Automatic", and click "Save".
4. Open https://chatgpt.com and send: "My favorite food is pizza. Reply only: ok".
5. A few seconds after the answer, the purple "Save to Mem0" button at the bottom right turns green ("Saved ✓"), and the toolbar popup lists the memory created (e.g. "User's favorite food is pizza").
6. Send a question with nothing personal (e.g. "What is 12 x 12?"): the button only blinks grey, because Mem0 decides there is nothing worth keeping.
7. The same works on https://gemini.google.com (requires a Google account).

The interface is available in English (US) and Portuguese (Brazil); the language can be changed at the top of the settings page.
No remote code is used. The only servers contacted are mcp.mem0.ai and api.mem0.ai. Source code: https://github.com/dellanio/memory-bridge
```

**Publish**. A certificação leva até 7 dias úteis; depois disso o status vira **In the Store**.

---

## Se der erro

- **Validação do pacote falhou**: mande o print da mensagem.
- **Só um idioma aparece**: confirme que enviou o 1.0.1 (tem `_locales/en` e `_locales/pt_BR`).
- **Rejeitado por permissão ou marca**: mande o texto da rejeição; a correção vai num novo `.zip` com versão maior (1.0.2…).

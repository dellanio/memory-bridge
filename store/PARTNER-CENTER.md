# Roteiro de publicação — Partner Center (Edge Add-ons)

Segue as etapas de https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension.
Tudo o que estiver em bloco de código é para **copiar e colar** no campo indicado.

Arquivos (pasta `D:\projetos-pessoal\mem0-edge\`):
- Pacote: `dist\memory-bridge-1.0.3.zip`
- Imagens: `store\`

---

## Etapa 1 — Preparar (já feito)

- Protótipo funcionando: ✔
- Conta de desenvolvedor: **sua parte** (Partner Center → Programas → Microsoft Edge → Introdução, conta **Individual**).
- `.zip` com o `manifest.json` na raiz: ✔ `dist\memory-bridge-1.1.0.zip`
- Campos do manifest que viram texto da loja (não editáveis no Partner Center):
  - Nome: "Memory Bridge for Mem0" / "Memory Bridge para Mem0"
  - Descrição curta: "Automatically save what matters from your ChatGPT, Gemini and Claude chats to your own Mem0 account." / "Salve automaticamente o que importa das suas conversas do ChatGPT, Gemini e Claude na sua própria conta Mem0."

## Etapa 2 — Criar a extensão

Partner Center → **Página inicial** → cartão **Edge** → **Create new extension**.

## Etapa 3 — Enviar o pacote

Arraste `dist\memory-bridge-1.1.0.zip` → aguarde a validação → **Continue**.
O Partner Center deve listar **dois idiomas** (en e pt_BR). Se aparecer só um, ver "If a single locale appears" na página da Microsoft.

### Atalho: publicar pela API oficial (sem Partner Center)

Depois da primeira publicação, dá para subir a próxima versão pela **API de update do Edge Add-ons** (REST v1.1), que existe para CI/CD.

Dados desta extensão:

| | |
|---|---|
| Product ID | `c092211a-4fae-493b-a048-7f8cb12c13fd` |
| Store ID | `0RDCKB8HRMN4` |
| CRX ID | `hajblgdoncpkaojaklgpmndibhdoaice` |
| Client ID (Publish API) | `7733d7a4-f45c-4a11-8800-bf498221f3b4` |

1. Partner Center → **Microsoft Edge** → **Publish API** (`partner.microsoft.com/en-us/dashboard/microsoftedge/publishapi`) → **Turn on API**. O botão liga a API e **cria as credenciais na hora** (Client ID + API key). **A chave só é exibida nessa sessão** ("It won't be available for copy in your next session") — copie na hora.
2. As credenciais ficam em `store/edge-credentials.local.json` (no `.gitignore`, nunca vai para o git). O script lê esse arquivo; variáveis de ambiente (`EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`) têm precedência.
3. Na pasta do projeto:

```
npm run package
npm run publish:edge -- --dry-run     # mostra o plano sem enviar
npm run publish:edge -- --yes         # sobe o pacote e publica
npm run publish:edge -- --yes --notes "texto para a certificação"
```

O script empacota, envia o `.zip` para o rascunho (`POST /v1/products/$productID/submissions/draft/package`), acompanha a operação e publica (`POST /v1/products/$productID/submissions`). Sem `--yes` ele para no rascunho. A API **não** serve para criar produto novo nem para mexer em metadados (descrição, capturas) — isso continua sendo pela tela.

**Fila de submissão (importante).** A API só publica quando **não há nenhuma submissão em revisão**: se houver, a operação volta `Failed` com `errorCode: InProgressSubmission` ("Can't publish extension as your extension submission is in progress"). O script detecta isso, imprime a mensagem e sai com código 1 — o pacote **fica no rascunho**, e basta rodar `--yes` de novo depois. Para destravar na hora: Extension overview → **Cancel submission** na versão em revisão (leva 5–10 minutos) e só então publicar de novo.

O **rascunho da listagem (descrição, tiles, capturas) viaja junto da submissão do pacote**: depois de publicar, o botão "Publish" da tela "Store listings" responde *"Can't publish extension as your extension has not been modified since last push"* — sinal de que o metadado novo já foi para a revisão. Ele não é publicado sozinho.

> Histórico: 1.0.2 publicada em 07/10/2026 pela tela. 1.0.3 publicada em 11/11/2026 pela API (upload e publicação `succeeded`); revisão cancelada em 12/11/2026 para liberar a fila. 1.1.0 (Claude) publicada em 12/11/2026 pela API — upload e publicação `succeeded`, status "In review".

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
Saves the user's ChatGPT, Gemini and Claude conversations to the user's own Mem0 account, so the facts and preferences found in those chats become long-term memory that other Mem0-connected assistants can use. The extension adds a "Save to Mem0" button to chatgpt.com, gemini.google.com and claude.ai and sends the last question and answer to Mem0 when the user clicks it (or automatically, if the user turns on automatic mode).
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

**Content scripts (chatgpt.com, chat.openai.com, gemini.google.com, claude.ai)** — se o formulário pedir:
```
Reads the last question and the last answer of the conversation open in the tab and shows the "Save to Mem0" button. The content script runs only on these four sites and does not read other pages, cookies or form fields.
```

### Are you using remote code?

**No, I am not using remote code.**

### Data usage — What user data do you plan to collect

Marque **somente**:
- [x] **Website content** (o texto da pergunta e da resposta da conversa aberta)
- [x] **Personal communications** (as mensagens que o usuário troca com o ChatGPT, o Gemini ou o Claude, enviadas para a conta Mem0 dele)

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
| Search terms | `mem0`, `memory`, `chatgpt`, `gemini`, `claude`, `ai memory`, `productivity`, `context` | `mem0`, `memória`, `chatgpt`, `gemini`, `claude`, `memória ia`, `produtividade`, `contexto` |

Não use o botão "Generate with AI": a descrição pronta já foi revisada.
**Save draft** em cada idioma. A coluna Status deve ficar **Complete** nas duas linhas.

### Como essa tela se comporta (armadilhas)

- **Imagem só existe depois de "Save draft".** Excluir ou enviar um tile/captura muda só o modelo do cliente; a gravação é o `PUT .../listings/Assets/bulk` que sai no "Save draft" (o upload em si é `POST .../listings/Assets` + `.../commit`, que acontecem na hora).
- **Um refresh do modelo apaga o que não foi salvo.** O app busca `GET .../listings/storeListings` de tempos em tempos (também quando a aba volta ao foco). Se isso rolar entre a troca de imagem e o "Save draft", a exclusão/upload é perdida e o servidor devolve a versão antiga. Faça as trocas de imagem e salve em sequência, sem pausas.
- **Captura tem tamanho fixo: exatamente 1280 × 800 ou 640 × 400.** Qualquer outro tamanho é recusado com "File size is incorrect for `<arquivo>`. Please try uploading a valid .png file that is exactly 1280 x 800 pixels or 640 x 400 pixels." — por isso `tools/store-assets.mjs` gera tudo em 1280 × 800.
- **O "Edit" da captura edita o título (legenda), não a imagem.** Para trocar a imagem: excluir a antiga (há confirmação) e enviar a nova pelo "Add Image".
- **O bloco promocional só tem "Magnify"/"Delete".** O "Add Image" (com o tamanho exigido) só aparece no slot vazio, depois de excluir o antigo.
- **"Publish" fica bloqueado enquanto houver submissão em revisão**: "Your extension is in-review. Update cannot be published right now, please try again later." As alterações ficam salvas (as duas linhas seguem **Complete**) e vão ao ar quando a revisão terminar — ou junto da próxima submissão.
- **Termos de busca**: o campo só registra o texto digitado (o Angular não pega valor colado); digite e clique em "Add Term". No máximo 7 termos e 21 palavras ao todo.

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
8. The same "Save to Mem0" button is injected on https://claude.ai — open any conversation there (a free Anthropic account is required to chat) and the button appears at the bottom right, saving the last exchange in the same way. The settings page shows a separate "Claude" site with its own app_id (claude).

The interface is available in English (US) and Portuguese (Brazil); the language can be changed at the top of the settings page.
No remote code is used. The only servers contacted are mcp.mem0.ai and api.mem0.ai. Source code: https://github.com/dellanio/memory-bridge
```

**Publish**. A certificação leva até 7 dias úteis; depois disso o status vira **In the Store**.

---

## Se der erro

- **Validação do pacote falhou**: mande o print da mensagem.
- **Só um idioma aparece**: confirme que enviou o 1.1.0 (tem `_locales/en` e `_locales/pt_BR`).
- **Rejeitado por permissão ou marca**: mande o texto da rejeição; a correção vai num novo `.zip` com versão maior (1.1.0…).

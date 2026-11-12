# Memory Bridge for Mem0

Browser extension for **Edge and Chrome** (Manifest V3) that saves what matters from your **ChatGPT**, **Gemini** and **Claude** conversations into **your own** [Mem0](https://mem0.ai) account, under **your** `user_id`.

> Independent project, not affiliated with Mem0, OpenAI, Google or Anthropic. "Mem0" is a trademark of its owners.

Browser extension for **Edge e Chrome** (Manifest V3) que salva o que importa das suas conversas do **ChatGPT**, **Gemini** e **Claude** na **sua** conta [Mem0](https://mem0.ai), com o **seu** `user_id`.

> Projeto independente, sem vínculo com a Mem0, OpenAI, Google ou Anthropic. "Mem0" é marca dos seus donos.

---

## What it does

- A **"Save to Mem0"** button on `chatgpt.com`, `gemini.google.com` and `claude.ai` (including ChatGPT installed as an Edge app).
- **Manual** mode (default: saves only when you click) or **automatic** mode (saves every completed answer).
- Sends the last exchange (your question + the answer) with a configurable `user_id`, a per-site `app_id` (default `chatgpt` / `gemini` / `claude`) and metadata (`site`, `conversation_id`, `url`). Mem0 extracts the facts; the whole conversation is not stored.
- Hides obvious secrets before sending (API keys, tokens, JWTs, private keys, card numbers). Can be turned off.
- Interface in **Portuguese (Brazil)** and **English (US)**: follows the browser language or whatever you pick at the top of the Settings screen.
- **Data-policy consent on first use:** the Settings screen opens with a plain-language disclosure of what is read and sent; nothing leaves the browser until you tick it and save, and unticking it revokes the consent.
- Never sends the same exchange twice. History of the last 30 actions in the toolbar icon, with a red "!" when something fails.

## O que faz

- Botão **"Salvar no Mem0"** nas páginas `chatgpt.com`, `gemini.google.com` e `claude.ai` (inclusive o ChatGPT instalado como app pelo Edge).
- Modo **manual** (padrão: só salva quando você clica) ou **automático** (salva toda resposta concluída).
- Envia a última troca (sua pergunta + a resposta) com `user_id` configurável, `app_id` por site (padrão `chatgpt` / `gemini` / `claude`) e metadados (`site`, `conversation_id`, `url`). O Mem0 extrai os fatos; a conversa inteira não é guardada.
- Oculta segredos óbvios antes de enviar (chaves de API, tokens, JWT, chaves privadas, números de cartão). Pode desligar.
- Interface em **Português (Brasil)** e **English (US)**: segue o idioma do navegador ou o que você escolher no topo da tela de Configurações.
- **Consentimento de política de dados na primeira uso:** a tela de Configurações abre com a divulgação, em linguagem simples, do que é lido e enviado; nada sai do navegador até você marcar a caixa e salvar, e desmarcar revoga o aceite.
- Não envia a mesma troca duas vezes. Histórico das últimas 30 ações no ícone, com "!" vermelho quando algo falha.

---

## Authentication

Three paths, all of them use your `user_id`:

1. **Sign in with your Mem0 account (OAuth, recommended).** Uses the official MCP server (`https://mcp.mem0.ai/mcp/`): dynamic client registration, OAuth 2.1 with PKCE (S256) and `chrome.identity.launchWebAuthFlow`. No password or key ever passes through the extension; the token stays in `chrome.storage.local` and renews itself. Writing uses the MCP `add_memory` tool, with arguments built from the schema the server advertises.
2. **API key on the MCP server (no OAuth).** The same Mem0 key goes into the `Authorization: Token m0-...` header of the MCP endpoint — the server accepts it and returns the same `add_memory`/`get_event_status` tools. It does not depend on the dynamic client registration, so it keeps working even when Mem0's registration is down.
3. **API key on the REST API (advanced).** Calls `POST https://api.mem0.ai/v3/memories/add/` directly. Use a dedicated key, which you can revoke without affecting other integrations.

### When Mem0 drops the registered client

Mem0 registers the extension's client dynamically (RFC 7591) and that store is recreated on every server deploy: the stored `client_id` stops existing and `/token` answers `invalid_client` — the sign-in dies on its own, with no way out.

Since 1.0.3 the extension protects itself:

- before signing in it **probes** the stored `client_id` (`invalid_client` = the server no longer knows the client; `invalid_grant` = the client is fine, only the refresh token died);
- client lost → **registers a new client** and redoes the authorization;
- client dies halfway → registers another one and redoes the code exchange;
- the error shows the server's `error_description` (`Invalid client_id`) instead of just the code;
- dynamic registration down (HTTP 5xx) → a message explaining that the API key is the way to go.

If the sign-in stops on its own, the fix is: **Settings → Connect** (the new client is registered automatically).

## Autenticação

Três caminhos, todos com o seu `user_id`:

1. **Entrar com a conta Mem0 (OAuth, recomendado).** Usa o servidor MCP oficial (`https://mcp.mem0.ai/mcp/`): registro dinâmico de cliente, OAuth 2.1 com PKCE (S256) e `chrome.identity.launchWebAuthFlow`. Nenhuma senha ou chave passa pela extensão; o token fica em `chrome.storage.local` e é renovado sozinho. A gravação usa a ferramenta `add_memory` do MCP, com argumentos montados a partir do schema que o servidor anuncia.
2. **Chave de API no servidor MCP (sem OAuth).** A mesma chave do Mem0 vai no header `Authorization: Token m0-...` do endpoint MCP — o servidor aceita e devolve as mesmas ferramentas `add_memory`/`get_event_status`. Não depende do registro dinâmico de cliente, então funciona mesmo com o registro do Mem0 fora do ar.
3. **Chave de API na API REST (avançado).** Chama `POST https://api.mem0.ai/v3/memories/add/` direto. Use uma chave dedicada, que dá para revogar sem afetar outras integrações.

### Quando o Mem0 descarta o cliente registrado

O Mem0 registra o cliente da extensão dinamicamente (RFC 7591) e essa store é recriada a cada deploy do servidor: o `client_id` guardado deixa de existir e o `/token` passa a responder `invalid_client` — o login morre sozinho, sem caminho de recuperação.

Desde a 1.0.3 a extensão se protege:

- antes de logar, **sonda** o `client_id` guardado (`invalid_client` = o servidor não conhece mais o cliente; `invalid_grant` = o cliente está de pé, só o refresh token morreu);
- cliente perdido → **registra um cliente novo** e refaz a autorização;
- cliente morto no meio do caminho → registra outro e refaz a troca do código;
- o erro mostra a `error_description` do servidor (`Invalid client_id`) em vez de só o código;
- registro dinâmico fora do ar (HTTP 5xx) → mensagem explicando que o caminho é a chave de API.

Se o login parar do nada, o conserto é: **Configurações → Conectar** (o cliente novo é registrado sozinho).

---

## Install (developer mode)

1. `edge://extensions` (or `chrome://extensions`) → turn on **Developer mode**.
2. **Load unpacked** → select this folder.
3. In the options screen that opens: read the data-policy disclosure at the top, tick **"I have read and agree"** and **Save**, then pick the authentication (OAuth, or API key on MCP/REST), click **Connect** (OAuth only) and fill in the **User ID**. **Test connection** confirms.

## Instalar (modo desenvolvedor)

1. `edge://extensions` (ou `chrome://extensions`) → ligue **Modo de desenvolvedor**.
2. **Carregar sem compactação** → selecione esta pasta.
3. Na tela de opções que abre: leia a divulgação de política de dados no topo, marque **"Li e concordo"** e **Salve**; depois escolha a autenticação (OAuth, ou chave de API no MCP/REST), clique **Conectar** (só no OAuth) e preencha o **User ID**. **Testar conexão** confirma.

---

## Development

```bash
npm test                                   # unit tests (node --test, no dependencies)
npm run package                            # builds dist/memory-bridge-<version>.zip (manifest at the root)
npm run publish:edge -- --dry-run          # publishes to the store via the Edge Add-ons API (sends nothing)
node tests/lang-check.mjs                 # Edge headless: options, popup and button translations
node tests/auth-heal.mjs                  # Edge headless: a dead sign-in heals itself
node tests/e2e-edge.mjs                    # Edge headless + extension on the real chatgpt.com (no login)
node tests/e2e-claude.mjs                  # Edge headless + extension on the real claude.ai (needs a sign-in once)
node tests/probe.mjs <url> [ms]            # DOM diagnostics when a site changes
```

### Publishing to the store

`npm run package` builds the `.zip` (only `manifest.json`, `icons/`, `_locales/` and `src/`). After the first submission through the Partner Center, the next version can go up through the **Edge Add-ons update API** (REST v1.1) with `npm run publish:edge` — credentials `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID` and `EDGE_API_KEY` from Partner Center → Microsoft Edge → Publish API. Details in `store/PARTNER-CENTER.md`.

Layout: `src/background.js` (OAuth, MCP client, sending, history), `src/content.js` (per-site adapters and the button), `src/lib.js` (pure, tested functions), `src/options.*`, `src/popup.*`, `_locales/{en,pt_BR}`.

### When a site changes its HTML

The adapters live in `src/content.js` (`ADAPTERS`). Run `tests/probe.mjs` with `PROBE_SEND="text"` to see the new structure and adjust the selectors. As of Oct/2026 ChatGPT uses `li[data-message-role=user|assistant]` and marks the finished answer with `data-message-complete`; the old layout (`[data-message-author-role]`) is still supported.

Claude is the pickiest one, and the reason is **virtualization**: `claude.ai` keeps only the last few turns mounted in the DOM (the real total lives in `aria-setsize`), so the adapter reads the last *mounted* exchange. The selectors below were verified against a live signed-in session in Nov/2026:

| What | Selector |
|---|---|
| Turn row (role in `data-perf-row="human\|assistant"`) | `[data-testid="transcript-row"]` |
| User text | `[data-testid="user-message"]` |
| Claude text | `[data-perf-reply-text]` (inside `.standard-markdown`) |
| Streaming | `[data-testid="assistant-message"][data-is-streaming="true"]` |
| Conversation id | `https://claude.ai/chat/<uuid>` |

Claude renames its `data-testid`s often, so the adapter reads the message from narrow nodes (never from the whole row, which carries the screen-reader label "Você disse:" / "Claude respondeu:") and the popup diagnostic reports which site was matched — a rename shows up instead of failing silently.

### Quando um site mudar o HTML

Os adaptadores ficam em `src/content.js` (`ADAPTERS`). Rode `tests/probe.mjs` com `PROBE_SEND="texto"` para ver a nova estrutura e ajuste os seletores. Em out/2026 o ChatGPT usa `li[data-message-role=user|assistant]` e marca a resposta concluída com `data-message-complete`; o layout antigo (`[data-message-author-role]`) continua suportado.

O Claude é o mais difícil, e o motivo é a **virtualização**: o `claude.ai` mantém montados no DOM só os últimos turnos (o total real está em `aria-setsize`), então o adapter lê a última troca *montada*. Os seletores abaixo foram verificados numa sessão logada real em nov/2026:

| O quê | Seletor |
|---|---|
| Linha da troca (papel em `data-perf-row="human\|assistant"`) | `[data-testid="transcript-row"]` |
| Texto do usuário | `[data-testid="user-message"]` |
| Texto do Claude | `[data-perf-reply-text]` (dentro de `.standard-markdown`) |
| Gerando resposta | `[data-testid="assistant-message"][data-is-streaming="true"]` |
| Id da conversa | `https://claude.ai/chat/<uuid>` |

O Claude renomeia os `data-testid` com frequência, então o adapter lê o texto de nós estreitos (nunca da linha inteira, que carrega o rótulo de leitor de tela "Você disse:" / "Claude respondeu:") e o diagnóstico do popup mostra qual site casou — uma renomeação aparece em vez de falhar em silêncio.

---

## Publication (Edge Add-ons and Chrome Web Store)

- **Edge Add-ons**: 1.1.0 submitted and under review (store ID `0RDCKB8HRMN4`); the listing (en/pt), icon, screenshots and promo tiles are live.
- **Chrome Web Store**: item `jabbichbmjfhbmvpjkpinflnjffkgpe` na conta `planoplusdev@gmail.com`, versão 1.1.1 **enviada para revisão** (Pending review), listagem en-US, contato público `contato@dellanio.com`. O pacote próprio é `npm run package:chrome` (`minimum_chrome_version: 106`).
- Both stores share the same `src/`; only the manifest and the distribution channel differ. Route and pitfalls: `store/PARTNER-CENTER.md` (Edge) and `store/CHROME-STORE.md` (Chrome).
- Still pending: the Claude adapter has not been validated with a signed-in account, and the Edge item is scheduled to get 1.1.1 (the version with the data-policy consent) as soon as the 1.1.0 review frees the submission queue.

## Publicação (Edge Add-ons e Chrome Web Store)

- **Edge Add-ons**: 1.1.0 enviada e em revisão (store ID `0RDCKB8HRMN4`); a listagem (en/pt), o ícone, as capturas e os tiles já estão no ar.
- **Chrome Web Store**: item `jabbichbmjfhbmvpjkpinflnjffkgpe` na conta `planoplusdev@gmail.com`, versão 1.1.1 **enviada para revisão** (Pending review), listagem en-US, contato público `contato@dellanio.com`. O pacote próprio é `npm run package:chrome` (`minimum_chrome_version: 106`).
- As duas lojas usam o mesmo `src/`; só mudam o manifesto e o canal de distribuição. Roteiro e armadilhas: `store/PARTNER-CENTER.md` (Edge) e `store/CHROME-STORE.md` (Chrome).
- Pendente: o adaptador do Claude ainda não foi validado com conta logada, e o item do Edge tem a **1.1.1 agendada** (a versão com o consentimento de política de dados) para assim que a revisão da 1.1.0 liberar a fila de submissão.

## License

MIT

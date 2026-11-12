# Ficha da loja — Chrome Web Store

Roteiro campo a campo para o Painel de controle do desenvolvedor da Chrome Web Store
(https://chrome.google.com/webstore/devconsole).

- Conta de desenvolvedor: **planoplusdev@gmail.com**
- Pacote: `npm run package:chrome` → `dist/memory-bridge-1.1.1-chrome.zip`
- Item criado no painel: **Memory Bridge for Mem0**, ID `jabbichbmjfhbmvpjkpinflnjffkgpe`
  (criado no primeiro upload; a 1.1.0 foi o rascunho inicial e a 1.1.1 é a versão com o
  consentimento de política de dados, que o Chrome exige).
- Código: **o mesmo** da loja do Edge (`src/`, `icons/`, `_locales/`). A única diferença
  de manifesto é `minimum_chrome_version: "106"` (ver `scripts/package.mjs --chrome`).
- O item no Chrome é **novo**: extension ID, listagem e fila de revisão próprios.
  O Edge tem o seu ID e a sua fila; nada é compartilhado entre as duas lojas.

## Por que 106

| API usada | Onde | Chrome mínimo |
|---|---|---|
| `declarativeNetRequestWithHostAccess` | `src/background.js` (regra de sessão sem `Origin`) | 96 |
| condição `requestDomains` do DNR | `src/background.js` | 101 |
| `chrome.storage.session` | `src/background.js` (diagnóstico por site) | 102 |
| `chrome.identity.launchWebAuthFlow` | `src/background.js` (OAuth do Mem0) | 106 |
| service worker `type: "module"` | `manifest.json` | 91 |

## Propriedades

| Campo | Valor |
|---|---|
| Idioma da listagem | en-US (uma listagem por item) |
| Categoria | Workflow & Planning (Productivity) |
| Site (homepage) | https://dellanio.com |
| URL de suporte | https://dellanio.github.io/memory-bridge/ |
| Política de privacidade (URL) | https://dellanio.github.io/memory-bridge/privacy.html |
| Contato de suporte | dellanio@gmail.com |
| Público-alvo | 13+ / todos os públicos |
| Visibilidade | Pública |

O campo **Official URL** fica vazio de propósito: ele só aceita domínios registrados no
Search Console dessa conta, e o `dellanio.com` ainda não está registrado lá (o painel
mostra "This URL is not verified in Google Search Console"). Para usar, registre o domínio
no Search Console e associe à conta do Chrome Web Store.

## Imagens (reaproveitadas da loja do Edge — os tamanhos servem nos dois canais)

| Campo | Arquivo |
|---|---|
| Ícone (128×128) | `store/icon-128-rgb.png` (**sem canal alfa** — o Chrome recusa PNG com alfa; o `icons/icon128.png` da extensão tem alfa e não serve para a loja) |
| Capturas de tela (1280×800) | `store/screenshot-1-options-en.png`, `store/screenshot-2-popup-en.png` (ou `-pt`) |
| Bloco promocional pequeno (440×280) | `store/promo-440x280-en.png` (ou `-pt`) |
| Bloco promocional grande (1400×560) | `store/promo-1400x560-en.png` (ou `-pt`) |

O Chrome aceita captura de 1280×800 ou 640×400, até 5 por listagem. Os arquivos acima já
estão em 1280×800, em RGB (24-bit, sem alfa).

## Listagem

O Chrome Web Store publica **uma listagem por item** (um idioma). O texto abaixo está nos
dois idiomas: use o bloco do idioma escolhido como idioma da listagem.

### English (en-US) — recomendado

**Summary (≤132 caracteres)**

```
Automatically save what matters from your ChatGPT, Gemini and Claude chats to your own Mem0 account.
```

**Description**

```
Memory Bridge brings your ChatGPT, Gemini and Claude conversations into your Mem0 account, so your preferences, decisions and important details are available to any assistant connected to Mem0 (Claude, ChatGPT, your own agents and more).

How it works
- A "Save to Mem0" button appears on chatgpt.com, gemini.google.com and claude.ai.
- Automatic mode: every finished answer is sent to Mem0, which keeps only the relevant facts about you. When there is nothing worth keeping, the button just blinks grey.
- Manual mode: saves only when you click.
- Editable memory filter: tell Mem0 what to remember and what to ignore (by default it skips calculations, greetings and one-off questions).
- If the Mem0 sign-in drops, the "Reconnect" button redoes the authorization in one click.
- Interface in English (US) and Portuguese (Brazil).

Your account, your data
- Sign in with your Mem0 account (official Mem0 OAuth) or use an API key - straight to the REST API or to Mem0's own MCP server.
- You choose the User ID memories are saved under and the app_id for each site.
- API keys, tokens and card numbers that show up in a chat are hidden before sending.
- Everything goes straight from your browser to Mem0. No middle server, no tracking, no ads.

Requires a Mem0 account (https://mem0.ai). Independent project, not officially affiliated with Mem0, OpenAI, Google or Anthropic.
```

### Português (Brasil) (pt-BR)

**Summary (≤132 caracteres)**

```
Salve automaticamente o que importa das suas conversas do ChatGPT, Gemini e Claude na sua própria conta Mem0.
```

**Description**

```
O Memory Bridge leva as suas conversas do ChatGPT, do Gemini e do Claude para a sua conta Mem0, para que as suas preferências, decisões e informações importantes fiquem disponíveis para qualquer assistente conectado ao Mem0 (Claude, ChatGPT, agentes próprios e outros).

Como funciona
- Um botão "Salvar no Mem0" aparece no chatgpt.com, no gemini.google.com e no claude.ai.
- Modo automático: cada resposta concluída é enviada ao Mem0, que guarda só os fatos relevantes sobre você. Quando não há nada a guardar, o botão apenas pisca em cinza.
- Modo manual: só salva quando você clica.
- Filtro de memórias editável: diga ao Mem0 o que vale lembrar e o que ignorar (por padrão, ignora cálculos, saudações e perguntas pontuais).
- Se o login do Mem0 cair, o botão "Reconectar" refaz a autorização em um clique.
- Interface em português (Brasil) e inglês (EUA).

Sua conta, seus dados
- Entre com a sua conta Mem0 (OAuth oficial do Mem0) ou use uma chave de API - direto na API REST ou no próprio servidor MCP do Mem0.
- Você escolhe o User ID com que as memórias são gravadas e o app_id de cada site.
- Chaves de API, tokens e números de cartão que aparecerem na conversa são ocultados antes do envio.
- Tudo vai direto do seu navegador para o Mem0. Não há servidor intermediário, rastreamento nem anúncios.

Requer uma conta Mem0 (https://mem0.ai). Projeto independente, sem vínculo oficial com a Mem0, a OpenAI, o Google ou a Anthropic.
```

## Single purpose (campo obrigatório, ≤1000 caracteres)

```
Saves the user's own AI chat exchanges (ChatGPT, Gemini and Claude) to the user's own Mem0 account, so their preferences and decisions are available to any assistant connected to Mem0.
```

## Privacidade / data usage

O Chrome pede a declaração de uso de dados. A declaração usada é:

**Tipos de dados tratados (marcar):**

| Caixa | Item |
|---|---|
| ✅ | **Website content** — o texto da última pergunta e da última resposta |
| ✅ | **Personal communications** — as mensagens de chat |
| ✅ | **Authentication information** — o token/chave de API do Mem0 que o usuário autoriza |
| ⬜ | as demais (PII, Health, Financial, Location, Web history, User activity) |

**As três certificações (marcar todas):** não vende nem transfere dados para terceiros fora
do uso aprovado; não usa nem transfere dados para finalidades sem relação com o único
propósito; não usa nem transfere dados para avaliar a capacidade de crédito.

**Por que isso é honesto.** A extensão lê o conteúdo da página e o envia para fora do
navegador — para a conta Mem0 **do próprio usuário**, com as **credenciais do próprio
usuário**, a pedido do usuário. O desenvolvedor não recebe nada: não há servidor dele,
nem analytics, nem anúncios. O destino (mcp.mem0.ai / api.mem0.ai) é o serviço que o
usuário escolheu e mantém.

**Por que existe o consentimento (versão 1.1.1).** A Chrome Web Store exige que o produto
que trata dados do usuário mostre a divulgação de forma destacada **na própria interface**
e obtenha o consentimento afirmativo do usuário antes disso. Por isso a primeira seção da
página de opções é a divulgação ("Before you start: what this extension does with your
data") com uma caixa de aceite:

- sem o aceite, o service worker **recusa** qualquer envio (status `consent`);
- "Connect" e "Test connection" ficam bloqueados com a mensagem de política;
- desmarcar e salvar **revoga** o consentimento — nada mais é enviado;
- a política de privacidade publicada tem a declaração de **Limited Use** exigida pelo
  Chrome, e está a um clique da extensão (link "Full privacy policy" na página de opções).

## Notas para a certificação (o revisor precisa de um caminho de teste)

```
The extension needs a free Mem0 account (https://app.mem0.ai) to be tested.

1. After installing, the options page opens. It starts with a data-policy disclosure: tick "I have read and agree: the last question and answer may be sent to my Mem0 account, and nothing is sent to the developer" and click "Save". Without that consent the extension refuses to send anything.
2. Click "Connect" and sign in to Mem0 (OAuth via chrome.identity.launchWebAuthFlow against https://mcp.mem0.ai). Alternatively choose an API key mode ("API key on the MCP server" or "API key") and paste a Mem0 API key.
3. Fill "User ID" (any text, e.g. "tester") and click "Save".
4. Open https://chatgpt.com (works without login) and send: "My favorite food is pizza. Reply only: ok".
5. In automatic mode the "Save to Mem0" button turns green ("Saved ✓") a few seconds after the answer; the toolbar popup lists the memory created ("User's favorite food is pizza"). A question with nothing personal (e.g. "What is 12 x 12?") only makes the button blink grey.
6. The same button is injected on https://gemini.google.com and https://claude.ai (both work without login; on Claude the conversation list is virtualized, so the extension reads the last mounted exchange).

Permissions:
- storage: settings, consent flag, sign-in token and recent activity, kept only in chrome.storage.local.
- identity: OAuth sign-in to Mem0 (launchWebAuthFlow).
- declarativeNetRequestWithHostAccess: one session rule that removes the Origin header only from the extension's own requests to mcp.mem0.ai (the Mem0 MCP server rejects requests that carry an Origin header with HTTP 403).
- Host permissions https://mcp.mem0.ai/* and https://api.mem0.ai/*: the only servers the extension talks to.
- Content scripts on chatgpt.com, chat.openai.com, gemini.google.com and claude.ai: read the last question/answer of the open conversation and show the save button. No data is sent anywhere except to the Mem0 account chosen by the user, and only after the user consents in the extension's own UI.

No remote code is loaded; all code is in the package.
```

## Armadilhas do Dev Console (o que difere do Edge)

- **O item é criado no primeiro upload**: no Dev Console, "Add new item" abre um seletor de
  arquivo; o upload do `.zip` já cria o item (e atribui o extension ID). Só dá para editar a
  listagem depois disso.
- **Não há API pública do Chrome Web Store para criar item nem subir a primeira versão**: a
  Publish API (v1.1, usada pelo `chrome-webstore-upload-cli`) só atualiza itens já existentes
  e exige credenciais OAuth do Google Cloud + refresh token. Para a primeira publicação, o
  upload é pelo painel.
- **A primeira revisão é a mais demorada**: item novo costuma levar bem mais que 7 dias úteis
  (o Edge é mais rápido). O status fica em "In review" no painel.
- **"Publish" é bloqueado** enquanto houver uma versão em revisão.
- O `dist/memory-bridge-1.1.0-chrome.zip` **não** vai para o Edge e o
  `dist/memory-bridge-1.1.0.zip` **não** vai para o Chrome: cada loja recebe o seu zip.

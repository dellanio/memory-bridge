# Ficha da loja — Chrome Web Store

Roteiro campo a campo para o Painel de controle do desenvolvedor da Chrome Web Store
(https://chrome.google.com/webstore/devconsole).

- Conta de desenvolvedor: **planoplusdev@gmail.com**
- E-mail de contato (público no item): **contato@dellanio.com** — precisa estar verificado
  para o item poder ser publicado (o painel pede isso em Settings → Profile → "Verify email
  address"; o link chega por e-mail e expira em 1 hora).
- Pacote: `npm run package:chrome` → `dist/memory-bridge-1.1.2-chrome.zip`
  (no ar: 1.1.1, com consentimento; 1.1.2 acrescenta os idiomas **fr** e **zh_CN**)
- Item criado no painel: **Memory Bridge for Mem0**, ID `jabbichbmfjhbmpijkpinflnijffkgpe`
  (criado no primeiro upload; a 1.1.0 foi o rascunho inicial, a 1.1.1 é a versão publicada com o
  consentimento de política de dados, e a 1.1.2 acrescenta os idiomas).
- Listagem pública: https://chromewebstore.google.com/detail/memory-bridge-for-mem0/jabbichbmfjhbmpijkpinflnijffkgpe
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

## Estado (15/11/2026)

- **PUBLICADO**: o item está no ar, público, com a versão **1.1.1**. O painel mostra
  **"Published - public"** e a listagem pública responde com o título, a descrição, as
  capturas e o botão "Add to Chrome".
- **1.1.2 EM REVISÃO** (enviada em 15/11/2026): acrescenta os idiomas **fr** e **zh_CN** e
  cria as listagens localizada em francês e em chinês simplificado. Status no painel:
  **Pending review** (a 1.1.1 continua no ar até a aprovação; a publicação é automática
  depois dela, porque a opção "publish automatically after review" ficou marcada).
- Item: **Memory Bridge for Mem0** — ID `jabbichbmfjhbmpijkpinflnijffkgpe`.
- Listagem pública: https://chromewebstore.google.com/detail/memory-bridge-for-mem0/jabbichbmfjhbmpijkpinflnijffkgpe
- Evidência de que está instalável (o endpoint de atualização do Chrome devolve o pacote):
  `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3Djabbichbmfjhbmpijkpinflnijffkgpe%26uc`
  → **302** para `clients2.googleusercontent.com/crx/blobs/...` → **200**, ~48 KB,
  arquivo final `..._JABBICHBMFJHBMPIJKPINFLNIJFFKGPE_1_1_1_0.crx` (1.1.1.0).
- Detalhes públicos que a loja exibe: versão **1.1.1**, atualizado em **12/11/2026**,
  tamanho 47,27 KiB, 2 idiomas, categoria **Workflow & Planning**, 0 avaliações.
  O bloco "Privacy" mostra **Authentication information / Personal communications /
  Website content** e as 3 declarações de uso limitado.
- Contato público: `contato@dellanio.com` (verificado — o link foi confirmado em 12/11/2026).
- Pacote no ar: **1.1.1** (17 arquivos, `minimum_chrome_version: 106`).
- **Próxima versão preparada: 1.1.2** (19 arquivos — os mesmos + `_locales/fr` e
  `_locales/zh_CN`) → `dist/memory-bridge-1.1.2-chrome.zip`. Ela traz os quatro idiomas
  (en, pt_BR, fr, zh_CN) e precisa de uma nova revisão do Google para entrar no ar.
- Listagem en-US: título e summary vêm do pacote; descrição (1.607 caracteres), categoria
  **Workflow & Planning**, ícone 128×128 (sem alfa), 2 capturas 1280×800 (localizadas e
  globais), tiles 440×280 e 1400×560, homepage `dellanio.com`, suporte
  `dellanio.github.io/memory-bridge/`.
- Privacidade: single purpose + 4 justificativas (storage, identity, DNR, host permissions),
  URL da política de privacidade, tipos de dados marcados (**Website content**, **Personal
  communications**, **Authentication information**) e as 3 certificações marcadas.
- Distribuição: gratuito, **público**, todas as regiões.
- Instruções de teste: usuário/senha de uma conta de teste do Mem0 + 439 caracteres de passo
  a passo (inclui marcar o consentimento na tela de opções).
- **Aprovado sem ajustes**: o Google aprovou e publicou sozinho (a opção "publish automatically
  after review" ficou marcada), entre 12/11 e 15/11/2026.

### Armadilha do ID (erro que já custou tempo)

O extension ID do Chrome é uma string de 32 caracteres; **copiar à mão dá erro fácil** (na
primeira versão desta ficha o ID estava com letras trocadas — `...bmjhbmvpjk...` em vez de
`...bmfjhbmpij...`), e o sintoma é enganoso: o endpoint do CRX devolve **404** e a página
`/detail/<slug>/<id>` redireciona para a home, como se a extensão não existisse. A forma
segura de pegar o ID é **não digitar**: abrir a listagem pública e ler o `href` do card na
busca da loja, ou copiar o `..._JABBICH..._1_1_1_0.crx` do endpoint de atualização. Se o
painel e a busca pública mostrarem o item, mas o CRX der 404, **suspeite do ID, não da
publicação**.

## O que o painel já ensinou (armadilhas)

- **O item nasce no primeiro upload**: "Add new item" abre um seletor de arquivo e o upload do
  `.zip` já cria o item e atribui o extension ID. Só depois dá para editar a listagem.
- **Trocar versão**: "Upload new package" na aba Package; o painel vai para a Store listing
  e passa a mostrar "Title/Summary from package" da nova versão.
- **Trocar imagem**: o ícone de lixeira só aparece no hover da miniatura, e a remoção pede
  confirmação ("Remove"). Depois é preciso subir de novo — não há "substituir".
- **O `upload_files` do runtime às vezes devolve erro e mesmo assim envia** (Electron): o
  arquivo chega; confirme pela miniatura antes de tentar de novo (reenviar duplica a imagem).
- **Não existe URL direta para as abas do item**: os links do menu são relativos
  (`./webstore/devconsole/<publisher>/<item>/edit/privacy`) e só funcionam por clique; abrir a
  URL completa na mão devolve 404 ou cai no painel.
- **"Why can't I submit?"** lista exatamente o que falta — é o atalho para diagnosticar.
- **O Official URL** só aceita domínios registrados no Search Console dessa conta; sem isso
  o campo rejeita com "This URL is not verified in Google Search Console".
- **A Publish API do Chrome Web Store** (v1.1) só atualiza itens já existentes e exige OAuth
  do Google Cloud + refresh token; a primeira publicação é pelo painel.

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

HOW IT WORKS
- A "Save to Mem0" button appears on chatgpt.com, gemini.google.com and claude.ai.
- Automatic mode: every finished answer is sent to Mem0, which keeps only the relevant facts about you. When there is nothing worth keeping, the button just blinks grey.
- Manual mode: saves only when you click.
- Editable memory filter: tell Mem0 what to remember and what to ignore (by default it skips calculations, greetings and one-off questions).
- If the Mem0 sign-in drops, the "Reconnect" button redoes the authorization in one click.
- Interface in English (US) and Portuguese (Brazil).

YOUR ACCOUNT, YOUR DATA
- The Settings screen opens with a plain-language data policy. Nothing leaves your browser until you tick the consent box and save, and unticking it stops the extension from sending anything.
- Sign in with your Mem0 account (official Mem0 OAuth) or use an API key - straight to the REST API or to Mem0's own MCP server.
- You choose the User ID memories are saved under and the app_id for each site.
- API keys, tokens and card numbers that show up in a chat are hidden before sending.
- Everything goes straight from your browser to Mem0. No middle server, no tracking, no ads. The developer never receives your data.

Requires a Mem0 account (https://mem0.ai). Independent project, not officially affiliated with Mem0, OpenAI, Google or Anthropic.
```

> Esse é o texto **exatamente como está no ar** (verificado na listagem pública em
> 15/11/2026): cabeçalho em maiúsculas e a frase do consentimento como primeiro bullet de
> "Your account, your data". O bloco pt-BR abaixo é o texto alternativo, para quando a
> listagem for trocada de idioma.

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
- Interface em português (Brasil), inglês (EUA), francês e chinês simplificado.

Sua conta, seus dados
- A tela de Configurações abre com a política de dados em linguagem simples: nada sai do seu navegador até você marcar a caixa de aceite e salvar, e desmarcar faz a extensão parar de enviar.
- Entre com a sua conta Mem0 (OAuth oficial do Mem0) ou use uma chave de API - direto na API REST ou no próprio servidor MCP do Mem0.
- Você escolhe o User ID com que as memórias são gravadas e o app_id de cada site.
- Chaves de API, tokens e números de cartão que aparecerem na conversa são ocultados antes do envio.
- Tudo vai direto do seu navegador para o Mem0. Não há servidor intermediário, rastreamento nem anúncios. O desenvolvedor nunca recebe os seus dados.

Requer uma conta Mem0 (https://mem0.ai). Projeto independente, sem vínculo oficial com a Mem0, a OpenAI, o Google ou a Anthropic.
```

### Français (fr)

**Summary (≤132 caracteres)**

```
Enregistrez automatiquement l’essentiel de vos conversations ChatGPT, Gemini et Claude dans votre propre compte Mem0.
```

**Description**

```
Memory Bridge transpose vos conversations ChatGPT, Gemini et Claude dans votre compte Mem0, afin que vos préférences, vos décisions et vos informations importantes soient disponibles pour tout assistant connecté à Mem0 (Claude, ChatGPT, vos propres agents, etc.).

COMMENT ÇA MARCHE
- Un bouton « Enregistrer dans Mem0 » apparaît sur chatgpt.com, gemini.google.com et claude.ai.
- Mode automatique : chaque réponse terminée est envoyée à Mem0, qui ne conserve que les faits pertinents à votre sujet. Quand il n’y a rien à retenir, le bouton se contente de clignoter en gris.
- Mode manuel : l’enregistrement a lieu uniquement lorsque vous cliquez.
- Filtre de mémoires éditable : indiquez à Mem0 ce qu’il faut retenir et ce qu’il faut ignorer (par défaut, les calculs, les salutations et les questions ponctuelles sont écartés).
- Si la connexion Mem0 est perdue, le bouton « Reconnecter » relance l’autorisation en un clic.
- Interface en français, anglais (États-Unis), portugais (Brésil) et chinois simplifié.

VOTRE COMPTE, VOS DONNÉES
- L’écran de Paramètres s’ouvre avec une politique de données en langage simple. Rien ne quitte votre navigateur tant que vous n’avez pas coché la case de consentement et enregistré ; décocher la case puis enregistrer arrête l’envoi.
- Connectez-vous avec votre compte Mem0 (OAuth officiel de Mem0) ou utilisez une clé d’API - directement vers l’API REST ou vers le serveur MCP de Mem0.
- Vous choisissez l’User ID sous lequel les mémoires sont enregistrées et l’app_id de chaque site.
- Les clés d’API, les jetons et les numéros de carte qui apparaissent dans une conversation sont masqués avant l’envoi.
- Tout va directement de votre navigateur vers Mem0. Aucun serveur intermédiaire, aucun pistage, aucune publicité. Le développeur ne reçoit jamais vos données.

Nécessite un compte Mem0 (https://mem0.ai). Projet indépendant, sans lien officiel avec Mem0, OpenAI, Google ou Anthropic.
```

### 中文（简体）(zh-CN)

**Summary (≤132 caracteres)**

```
自动将 ChatGPT、Gemini 和 Claude 对话中的重要内容保存到你自己的 Mem0 账户。
```

**Description**

```
Memory Bridge 将你的 ChatGPT、Gemini 和 Claude 对话带入你的 Mem0 账户，让你的偏好、决定和重要信息可供任何连接到 Mem0 的助手使用（Claude、ChatGPT、你自己的智能体等）。

使用方法
- 在 chatgpt.com、gemini.google.com 和 claude.ai 上会出现“保存到 Mem0”按钮。
- 自动模式：每一条完成的回答都会发送到 Mem0，Mem0 只保留与你有关的重要事实。如果没有值得保存的内容，按钮只会闪烁灰色。
- 手动模式：只有在你点击时才会保存。
- 可编辑的记忆过滤器：告诉 Mem0 该记住什么、该忽略什么（默认会跳过计算、问候和一次性提问）。
- 如果 Mem0 的登录失效，“重新连接”按钮一键重新完成授权。
- 界面支持中文（简体）、英文（美国）、葡萄牙语（巴西）和法语。

你的账户，你的数据
- 设置页面打开时会先用通俗语言说明数据政策。在你勾选同意并保存之前，不会发送任何内容；取消勾选并保存后，扩展会停止发送。
- 使用你的 Mem0 账户登录（Mem0 官方 OAuth），或使用 API 密钥 - 直接发送到 REST API 或 Mem0 自有的 MCP 服务器。
- 你可以选择记忆保存所用的 User ID，以及每个站点的 app_id。
- 对话中出现的 API 密钥、令牌和银行卡号会在发送前被隐藏。
- 所有内容都从你的浏览器直接发送到 Mem0。没有中间服务器，没有追踪，没有广告。开发者不会收到你的任何数据。

需要 Mem0 账户（https://mem0.ai）。本项目为独立项目，与 Mem0、OpenAI、Google 或 Anthropic 无官方关联。
```

### Imagens por idioma (Chrome)

O Chrome separa **assets localizados** (por idioma da listagem) de **assets globais**. Para as
listagens fr e zh-CN, subir os arquivos localizados:

| Idioma da listagem | Captura 1280×800 | Blocos promocionais |
|---|---|---|
| en-US (padrão) | `store/screenshot-1-options-en.png`, `store/screenshot-2-popup-en.png` | globais (tiles em inglês) |
| fr | `store/screenshot-1-options-fr.png`, `store/screenshot-2-popup-fr.png` | `store/promo-440x280-fr.png`, `store/promo-1400x560-fr.png` |
| zh-CN | `store/screenshot-1-options-zh.png`, `store/screenshot-2-popup-zh.png` | `store/promo-440x280-zh.png`, `store/promo-1400x560-zh.png` |

Os blocos promocionais (440×280 e 1400×560) são **globais** no Chrome: só há um par, e o
texto sai em inglês. Os blocos em fr/zh acima servem para o Edge (que aceita imagens por
idioma de listagem) e para uso próprio.

Regenerar: `node tools/store-assets.mjs fr` e `node tools/store-assets.mjs zh-CN`
(idem `en-US` e `pt-BR`).

### Como adicionar uma listagem em outro idioma (Chrome)

O painel do Chrome Web Store tem, no topo da aba **Store listing**, um seletor
**"Current editing language"** (hoje: *English – en (default)*). É por ele que se cria uma
listagem em outro idioma — **não** é preciso criar outro item.

1. **Store listing** → seletor **Current editing language** → *Add language* → escolher
   *Français (fr)* e *中文（简体）(zh-CN)*.
2. Em cada idioma novo: colar a **Descrição** do bloco correspondente em "Listagem"
   (o **título** e o **summary** vêm do pacote, já traduzidos em `_locales/<idioma>`).
3. Subir as **capturas localizadas** (é obrigatório pelo menos uma por listagem —
   "Localized screenshots: At least one is required").
4. **Save draft**.
5. **Package** → *Upload new package* → `dist/memory-bridge-1.1.2-chrome.zip` → *Submit for
   review*.

O texto completo de cada idioma está nas seções "Listagem" acima.

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

The interface is available in English (US), Portuguese (Brazil), French and Simplified Chinese; the language can be changed at the top of the settings page (it also follows the browser language by default).
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
- **A primeira revisão levou ~3 dias** (enviado em 12/11/2026, publicado em 15/11/2026) —
  bem menos que o "semanas" que o painel avisa, mas conte com variability: item novo pode
  levar bem mais que 7 dias úteis (o Edge é mais rápido). O status fica em "In review" no painel.
- **"Publish" é bloqueado** enquanto houver uma versão em revisão.
- O `dist/memory-bridge-1.1.0-chrome.zip` **não** vai para o Edge e o
  `dist/memory-bridge-1.1.0.zip` **não** vai para o Chrome: cada loja recebe o seu zip.

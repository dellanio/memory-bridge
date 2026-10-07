# Memory Bridge for Mem0

Extensão para **Edge e Chrome** (Manifest V3) que salva suas conversas do **ChatGPT** e do **Gemini** na **sua** conta [Mem0](https://mem0.ai), com o **seu** `user_id`.

> Projeto independente, sem vínculo com a Mem0 ou a OpenAI/Google. "Mem0" é marca dos seus donos.

## O que faz

- Botão **"Salvar no Mem0"** nas páginas `chatgpt.com` e `gemini.google.com` (inclusive o ChatGPT instalado como app pelo Edge).
- Modo **manual** (padrão: só salva quando você clica) ou **automático** (salva toda resposta concluída).
- Envia a última troca (sua pergunta + a resposta) com `user_id` configurável, `app_id` por site (padrão `chatgpt` / `gemini`) e metadados (`site`, `conversation_id`, `url`). O Mem0 extrai os fatos; a conversa inteira não é guardada.
- Oculta segredos óbvios antes de enviar (chaves de API, tokens, JWT, chaves privadas, números de cartão). Pode desligar.
- Interface em **Português (Brasil)** e **English (US)**: segue o idioma do navegador ou o que você escolher no topo da tela de Configurações.
- Não envia a mesma troca duas vezes. Histórico das últimas 30 ações no ícone, com "!" vermelho quando algo falha.

## Autenticação

1. **Entrar com a conta Mem0 (OAuth, recomendado).** Usa o servidor MCP oficial (`https://mcp.mem0.ai/mcp/`): registro dinâmico de cliente, OAuth 2.1 com PKCE (S256) e `chrome.identity.launchWebAuthFlow`. Nenhuma senha ou chave passa pela extensão; o token fica em `chrome.storage.local` e é renovado sozinho. A gravação usa a ferramenta `add_memory` do MCP, com argumentos montados a partir do schema que o servidor anuncia.
2. **Chave de API (avançado).** Chama `POST https://api.mem0.ai/v3/memories/add/` direto. Use uma chave dedicada, que dá para revogar sem afetar outras integrações.

## Instalar (modo desenvolvedor)

1. `edge://extensions` (ou `chrome://extensions`) → ligue **Modo de desenvolvedor**.
2. **Carregar sem compactação** → selecione esta pasta.
3. Na tela de opções que abre: escolha a autenticação, clique **Conectar** (OAuth) e preencha o **User ID**. **Testar conexão** confirma.

## Desenvolvimento

```bash
npm test                                   # testes unitários (node --test, sem dependências)
node tests/e2e-edge.mjs                    # Edge headless + extensão no chatgpt.com real (sem login)
MEM0_API_KEY=... node tests/e2e-edge.mjs --rest-user <user_teste>   # envia de verdade (apague o user depois)
node tests/probe.mjs <url> [ms]            # diagnóstico do DOM quando um site mudar
```

Estrutura: `src/background.js` (OAuth, cliente MCP, envio, histórico), `src/content.js` (adaptadores por site e botão), `src/lib.js` (funções puras testadas), `src/options.*`, `src/popup.*`, `_locales/{en,pt_BR}`.

### Quando um site mudar o HTML

Os adaptadores ficam em `src/content.js` (`ADAPTERS`). Rode `tests/probe.mjs` com `PROBE_SEND="texto"` para ver a nova estrutura e ajuste os seletores. Em out/2026 o ChatGPT usa `li[data-message-role=user|assistant]` e marca a resposta concluída com `data-message-complete`; o layout antigo (`[data-message-author-role]`) continua suportado.

## Publicação (Edge Add-ons e Chrome Web Store)

Pendências antes de publicar: ícones definitivos e capturas de tela, política de privacidade hospedada (base em `PRIVACY.md`), testar o fluxo OAuth com o ID definitivo da loja (o registro dinâmico se refaz sozinho quando o `redirect_uri` muda), validar o adaptador do Gemini com conta logada e decidir o nome (evitar "Mem0" como primeira palavra por causa da marca).

## Licença

MIT

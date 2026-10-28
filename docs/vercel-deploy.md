# Deploy Vercel e configuração do agente

Validado em 28/10/2026, horário de São Paulo. Nenhuma credencial é registrada neste documento.

## Aplicação publicada

- URL estável: https://nexo-assist-weld.vercel.app
- Console: https://nexo-assist-weld.vercel.app/analyst
- Projeto `nexo-assist`, escopo `gabrielcastrog2-7365`, plano **Hobby** verificado pelo CLI. Não foi contratado upgrade.
- Repositório `gabdecastro/nexo-assist`, branch de produção `main`, conexão GitHub verificada na API do projeto.
- Vite, Node 22.x, build `npm run build`, saída `dist`. Backend: função `api/index`, região `iad1`, PostgreSQL na Neon.
- Produção recebeu oito variáveis: quatro Secret (`DATABASE_URL`, `SESSION_SECRET`, `ANALYST_PASSWORD`, `GEMINI_API_KEY`) e quatro Config (`ALLOW_DEMO_SIGNUP=false`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `LLM_DAILY_LIMIT=100`, `LEGACY_OUTAGE_MS=0`). Preview não recebeu cópia dos segredos de produção.
- Cadastro de novos funcionários está desativado em produção. Contas demonstrativas seguem aceitando qualquer senha, como solicitado pelo desafio. O analista exige a senha configurada no ambiente.

## Validação executada

Build e 22 testes locais aprovados. Os mesmos fluxos básicos foram exercitados na URL pública, com dados temporários isolados no banco. O teste confirmou:

```text
PASS PostgreSQL connection and isolated fixture write
PASS App startup, login, articles, draft confirmation and persisted ticket
PASS Employee isolation
PASS Live Gemini semantic routing and audit on deployed application
PASS Production redeploy ready: dpl_Dz5MVkGoqRCDdDHUS4rrWwEGMK3F
PASS Remote ticket and conversation persistence after redeploy
PASS Human handoff, reply, return and closure persisted in PostgreSQL
PASS Removed test fixtures; existing records preserved
```

As rotas `/`, `/analyst` e `/api/health` retornaram HTTP 200 sem sessão Vercel. A saúde da API respondeu `{"ok":true}`. O teste posterior validou escrita/leitura real, permissões, modelo e handoff, não apenas o endpoint de saúde.

O deploy inicial e o redeploy de teste terminaram em `READY`. A inspeção encontrou a função `api/index` com 2,51 MB. Os registros do teste foram removidos, preservando os registros existentes; o consumo de modelo permanece contabilizado no teto diário.

## Falhas encontradas e correções

1. **CLI nativo:** o login permaneceu aguardando, embora a autorização tivesse sido confirmada. O fluxo foi cancelado e repetido com `VERCEL_CLI_USE_NATIVE_BINARY=0`; a versão Node concluiu e os comandos seguintes funcionaram.
2. **Gemini 2.5:** a listagem de modelos aceitou a chave, mas `generateContent` retornou HTTP 404: “This model models/gemini-2.5-flash-lite is no longer available to new users.” A API indicou `gemini-3.5-flash-lite`. Atualizei o padrão e a configuração; a chamada estruturada e o fluxo remoto funcionaram. O modelo oferece free tier segundo a documentação oficial, sujeito às cotas da conta; não foi alterada a configuração de billing.
3. **GitHub:** a primeira conexão retornou HTTP 400 solicitando Login Connection. Após o usuário conectar o GitHub, o CLI informou que o repositório já estava conectado. A API confirmou GitHub, organização, repositório e branch `main`.
4. **Configurações do painel:** o projeto recém-criado ainda mostrava Node 24 e detecção automática, embora o repositório já fixasse Node 22/Vite. O painel também foi alinhado explicitamente para evitar divergência futura.

## Configuração global do agente

Foi seguido o [guia oficial solicitado](https://vercel.com/get-started.md):

| Item | Estado verificado |
|---|---|
| CLI | Vercel 65.5.0 instalado globalmente; `whoami` retornou `gabrielcastrog2-7365`. |
| Guidance | Plugin `vercel@openai-curated` habilitado em escopo de usuário no Codex, versão 0.21.4. Não foram instaladas skills avulsas duplicadas. |
| Comandos | Arquivos de `status`, `deploy`, `env`, `bootstrap` e `marketplace` presentes no plugin. Descoberta dentro desta sessão depende de recarga. |
| MCP | Servidor global `vercel`, endpoint exato `https://mcp.vercel.com`; OAuth concluiu com `Successfully logged in`. |
| Configuração MCP | `~/.codex/config.toml`, mesclada pelo comando `codex mcp add`; outros servidores mantidos. |
| Estado MCP | `codex mcp list --json` mostrou `enabled: true`, `auth_status: o_auth`. |
| Teste MCP autenticado | Ainda não executado: `search_vercel_documentation` e `list_teams` não foram expostos à sessão já aberta. Recarregar o cliente e testar essas ferramentas. |
| Aprovações | Não foram alteradas as políticas de confirmação do usuário. |

A busca inicial do guia pela ferramenta web falhou por `Unsupported content-type: text/markdown`; o download com `curl` no endereço exato funcionou. A cópia temporária foi lida antes de instalar CLI, plugin e MCP.

## Arquivos e segredos

- `.env.local`: chave do Gemini e modelo, além das variáveis Neon já existentes; o link Vercel acrescentou seu token OIDC local. Arquivo ignorado pelo Git.
- `.env.production.local`: segredos de sessão/analista gerados aleatoriamente e parâmetros de produção; permissão `0600`, ignorado pelo Git. Valores enviados ao CLI por stdin, não como argumentos.
- `.vercel/`: vínculo local do projeto, ignorado pelo Git.
- `.vercelignore`: exclui segredos, `.neon`, o guia local e arquivos de teste/suporte do upload.
- `.nvmrc`, `package.json` e lockfile: Node 22 e dependências reproduzíveis.
- `server/llm.ts`, `server/agent.ts`, `.env.example`: modelo padrão compatível com a conta nova.
- `scripts/smoke-neon.mjs`: suporte a teste remoto, Gemini real e persistência após redeploy opcional.
- `README.md` e este documento: URL publicada e limites da validação.
- `DEPLOY_VERCEL.local.md`: atualizado com etapas concluídas, localização privada da senha e instruções de manutenção; continua fora do Git e do upload.

A inspeção `vercel deploy --dry --json` confirmou framework Vite e excluiu `.env.local`, `.env.production.local`, `.neon` e o guia local. O bundle do frontend foi verificado sem encontrar as strings de conexão do banco. Nenhum token ou senha foi adicionado ao repositório.

## Operação

Pushes para `main` acionam o deploy Git. Para uma publicação manual:

```bash
VERCEL_CLI_USE_NATIVE_BINARY=0 vercel deploy --prod --scope gabrielcastrog2-7365
```

Os limites e a autenticação continuam próprios de uma demonstração. Este teste não comprova prontidão para uso corporativo, segurança sob ataque ou qualidade semântica em todos os cenários. O fluxo público usa dados fictícios e os limites de aplicação descritos no README.

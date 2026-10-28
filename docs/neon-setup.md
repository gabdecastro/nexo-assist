# Instalação e validação Neon — 28/10/2026

Este registro cobre a configuração de PostgreSQL solicitada e a conferência posterior das skills/MCP. Não contém credenciais. As alterações desta etapa foram preparadas localmente e incorporadas ao histórico na etapa seguinte de deploy.

## Skills e MCP

A skill foi buscada no endereço exato solicitado: <https://neon.com/.well-known/agent-skills/neon/SKILL.md>. A leitura via ferramenta web não estava disponível; `curl -fsSL` funcionou e salvou uma cópia temporária de 507 linhas fora do projeto. Foram consultadas também as skills instaladas `neon` e `neon-postgres` e a referência `neon/references/parse-env.md`.

O plugin `neon-postgres@plugins-cli` está habilitado na configuração de usuário do Codex. Seu manifesto instalado é versão 2.3.0; inclui as skills e `mcp.json` com servidor `neon`, URL `https://mcp.neon.tech/mcp`, sem headers de credencial ou API key no arquivo. Isso disponibiliza a configuração global para este projeto; não foi adicionada uma segunda configuração MCP local. O plugin usa OAuth; a autorização MCP é independente do login do CLI. Suas ferramentas não apareceram nesta sessão já aberta, portanto a conexão MCP ao vivo não foi testada; pode exigir recarregar o cliente e autenticar pelo próprio plugin.

`npx --yes neon skills status --global` retornou `up to date` para as nove skills: neon, neon-ai-gateway, neon-auth, neon-functions, neon-object-storage, neon-postgres, neon-postgres-branches, neon-postgres-egress-optimizer e neon-realtime. Não houve atualização ou reinstalação adicional após essa conferência.

No `init` da solicitação anterior, o CLI já havia instalado:

- Plugin Neon em escopo de usuário para Claude Code/Desktop, Codex, Cursor e VS Code.
- As nove skills em escopo de usuário para Antigravity, Gemini CLI e GitHub Copilot.
- MCP OAuth em `~/.gemini/config/mcp_config.json`, `~/.gemini/settings.json` e `~/.copilot/mcp-config.json`.

Essas instalações globais foram feitas pelo comportamento padrão do comando exato solicitado, sem `--agent`. Na conferência posterior, nenhuma configuração global foi reescrita. Os serviços existentes e o driver de PostgreSQL da aplicação foram mantidos.

## Comandos e saídas reais

CLI usado via npx, sem instalação global do binário:

```text
$ npx --yes neon --version
8.13.2
```

```text
$ npx --yes neon init -y --org-id org-ancient-tree-08175405 --project-id shy-base-16963757 --branch production --services postgres
Linked .neon
  Project         shy-base-16963757
  Branch          production
  Org             org-ancient-tree-08175405
Written offline (--no-checks): nothing was verified.
Creating neon.ts...
Installing Neon dependencies with npm...
added 18 packages, and audited 219 packages in 1s
found 0 vulnerabilities
```

O init terminou com código 0, mas seu resumo avisou `Project linked, not verified`. Ainda não havia credenciais. Ele não comprovou conectividade com o banco.

```text
$ npx --yes neon deploy
Awaiting authentication in web browser.
Auth complete (profile DEFAULT)
→ Applying to branch production (br-square-shape-b4wxyssq)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 3 Neon variables into .env.local
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
  Branch          NEON_BRANCH
[exit 0]
```

A autenticação concluiu, sem erro ou timeout. O CLI não precisou alterar serviços remotos porque a branch já correspondia à política. `neon deploy` não hospeda o frontend/API desta aplicação: o único serviço declarado e testado aqui foi PostgreSQL.

Primeira compilação:

```text
$ npm run build
server/env.ts(7,82): error TS2322: Type 'ProcessEnv' is not assignable to type 'DotenvPopulateInput'.
  'string' index signatures are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
[exit 2]
```

Correção: o carregador passou a deixar o dotenv usar `process.env` por padrão; um objeto explícito de strings é aceito apenas quando fornecido. Segunda compilação:

```text
$ npm run build
vite v6.4.5 building for production...
✓ 1587 modules transformed.
✓ built in 532ms
[exit 0]
```

Teste ponta a ponta, com API real e PostgreSQL real:

```text
$ node scripts/smoke-neon.mjs
PASS PostgreSQL connection and isolated fixture write
PASS App startup, login, articles, draft confirmation and persisted ticket
PASS Employee isolation
PASS Ticket and conversation survive application restart
PASS Human handoff, reply, return and closure persisted in PostgreSQL
PASS Removed test fixtures; existing records preserved
[exit 0]
```

O teste iniciou o Express duas vezes em portas temporárias e encerrou ambos os processos. Usou dois funcionários isolados, confirmou um ticket, verificou leitura por outra identidade, persistência após reinício e o fluxo do analista. Removeu somente os funcionários, tickets e conversas do teste. Gemini foi desativado nesse processo, pois não é um serviço provisionado nesta tarefa.

A suíte offline executada após o build corrigido retornou:

```text
ℹ tests 22
ℹ pass 22
ℹ fail 0
[exit 0]
```

Verificações adicionais:

```text
PASS: provisioned database credentials absent from frontend build
Local secret file mode: 600
```

`.env.local`, `.neon` e `DEPLOY_VERCEL.local.md` são ignorados pelo Git; os dois primeiros não aparecem em `git ls-files`. A verificação do bundle procurou os valores reais de conexão sem imprimi-los. `git diff --check` não apontou problemas.

## Arquivos e configurações alterados

| Arquivo | Mudança |
|---|---|
| `neon.ts` | Gerado pelo CLI: PostgreSQL, `auth: false`, mantém configuração de branches existentes e TTL de sete dias para novos branches não padrão. Não foi reescrito depois. |
| `.neon` (ignorado) | Vínculo local com organização, projeto e branch solicitados. |
| `.env.local` (ignorado) | Três variáveis provisionadas pelo CLI. Permissão ajustada para `0600`. Valores não foram copiados para código ou documentação. |
| `.gitignore` | CLI acrescentou `.neon`; demais regras preservadas. |
| `package.json` | CLI adicionou `@neon/config` e `@neon/env`; adicionado comando opt-in `test:neon`. |
| `package-lock.json` | Dependências do CLI/configuração resolvidas. |
| `server/env.ts` | Carrega `.env.local` e `.env`, preservando variáveis já injetadas, inclusive valores vazios usados pelos testes offline. |
| `server/app.ts` | Usa o novo carregador antes de importar os serviços. |
| `tsconfig.json` | Inclui `neon.ts` na checagem TypeScript. |
| `.env.example` | Documenta precedência, URL direta opcional e identificador de branch, sem valores secretos. |
| `tests/env.test.mjs` | Verifica precedência de arquivos e isolamento explícito do banco remoto. |
| `scripts/smoke-neon.mjs` | Teste opt-in contra banco real com limpeza dos registros temporários. |
| `README.md` | Instruções Neon, comando de teste e resultado de validação real. |
| `docs/neon-setup.md` | Este relatório de mudanças, saídas e limitações. |

A aplicação continua usando `@neondatabase/serverless` e `DATABASE_URL` para tráfego normal. `DATABASE_URL_UNPOOLED` é conservada para ferramentas administrativas; `NEON_BRANCH` é metadado. A autenticação demo, o provedor Gemini e a configuração Vercel foram preservados. Não foram provisionados Auth, Functions, Storage, Realtime ou AI Gateway.

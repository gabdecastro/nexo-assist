# Nexo Assist

Service desk de demonstração com chat, triagem auditável em LangGraph.js, integração Gemini, serviço simulado de chamados e console de analista. Implementado a partir de [spec.md](spec.md) e das seis telas de [nexo.pen](design/nexo.pen).

## Executar

Requisitos: Node.js 22+ e npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Abra <http://localhost:5173>. Para executar o build com frontend e API no mesmo servidor:

```bash
npm run build
npm start
```

Abra <http://localhost:3001>. A persistência local é criada em `data/db.json`. Conversas, rascunhos, tickets, auditoria e estado humano sobrevivem ao reinício. Para zerar somente a demonstração local, pare o servidor e remova esse arquivo.

Funcionários: `ana.souza@nexo.com.br` (alias de `ana.souza@nexo.com`), `marcos.lima@nexo.com`, `julia.costa@nexo.com` e `paulo.mendes@nexo.com`; qualquer senha não vazia, conforme o desafio. Localmente, outros e-mails criam perfis isolados quando `ALLOW_DEMO_SIGNUP` não é `false`. Na Vercel, o cadastro fica desativado. O console está em `/analyst`: use `ANALYST_PASSWORD`, ou qualquer senha apenas no modo local sem essa configuração.

## Spec driven development e revisão

A [spec](spec.md) define histórias, regras, critérios de aceite e tokens visuais. A [revisão do desafio](docs/review.md) relaciona os requisitos às evidências e limitações. O PDF é a fonte das regras; o Pen orienta a interface. A revisão corrigiu a exclusão indevida do LLM na spec inicial, além de SLA, contexto, deduplicação e persistência para serverless.

O repositório estava sem histórico. Os primeiros 14 commits organizam os arquivos existentes em etapas lógicas, com datas reais; não são versões antigas recuperadas. Os commits seguintes registram as correções efetivamente realizadas durante a revisão.

## Arquitetura

| Camada | Responsabilidade |
|---|---|
| `src/ui` | React/Vite: login, conversa, perfil, fila e console. Estilos/fontes locais derivados do Pen. |
| `server/app.ts` | Express 5: sessões assinadas, autorização, validação, API e frontend estático. |
| `server/index.ts` / `api/index.ts` | Listener local / export da função Vercel, respectivamente. |
| `server/agent.ts` | Grafo LangGraph: registrar → interpretar → aplicar política → persistir. Conversas humanas pulam a interpretação. |
| `server/llm.ts` | Gemini REST, contrato JSON validado, contexto limitado, timeout e orçamento diário. |
| `server/ticket-service.ts` | Serviço legado simulado: consulta, criação, atualização, reabertura, deduplicação e indisponibilidade. |
| `server/sla.ts` | Calendário de atendimento e plantão crítico. |
| `server/store.ts` | Repositório: JSON atômico local ou Neon quando `DATABASE_URL` existe. |
| `server/neon-store.ts` / `snapshot-store.ts` | Snapshot PostgreSQL com versão e atualização condicional para evitar perda por concorrência. |

Há quatro funcionários, sete artigos e seis chamados iniciais, incluindo vencido, resolvido recentemente e tickets de outras pessoas. Todas as consultas de funcionário são filtradas pela identidade assinada no servidor.

## Como o agente decide

1. Registra a mensagem e valida identidade, estado, processamento concorrente e limite de 30 mensagens.
2. Mensagens durante atendimento humano são persistidas sem resposta automática. Botões e confirmações de rascunho não precisam de LLM.
3. Com `GEMINI_API_KEY`, o modelo interpreta texto livre em um conjunto fechado de intenções e pode indicar um artigo existente. A saída é validada; ele não executa ferramentas de escrita nem decide se uma confirmação ocorreu.
4. As regras verificam escopo de TI, pedido humano, confirmação/cancelamento, consulta de tickets próprios, impacto/urgência e aplicabilidade dos artigos. Sem impacto suficiente, o rascunho permanece incompleto. Artigo de VPN exige verificar Windows 10/11.
5. Criar/atualizar exige confirmação explícita de rascunho completo. O serviço busca problema equivalente no mesmo tipo/categoria; reabre resolvidos até sete dias e preserva histórico. Identificadores são alocados na mutação persistente.
6. Pedido humano, caso crítico ou ausência de orientação segura transferem com resumo e histórico. Na consulta de ticket vencido, a interface oferece transferência, seguindo a tela 3 do Pen. Essa interpretação é registrada na revisão porque o Anexo A também pode ser lido como transferência automática.
7. Cada decisão inclui intenção, ação, evidências, confiança, motivo e resultado; quando há interpretação do modelo, a evidência identifica Gemini/modelo e sua classificação. A justificativa é breve e verificável, não uma exposição de raciocínio interno.

Escolhi **LangGraph.js** por permitir um grafo explícito e tipado mantendo as políticas isoladas do modelo. **Gemini Flash-Lite** oferece um modelo pequeno com suporte a JSON estruturado e free tier para demonstração. A disponibilidade e as cotas devem ser verificadas na [documentação do provedor](https://ai.google.dev/gemini-api/docs/pricing). Sem chave, o grafo funciona em modo determinístico para exploração e testes; esse modo sozinho não demonstra o requisito de LLM.

## Qualidade e testes

```bash
npm run test:integration
```

Esse comando compila frontend/backend/entrada serverless e executa a suíte Node. Os testes usam dados e portas temporários; não alteram a demonstração nem consomem APIs reais. Cobrem privacidade, confirmações, edição, handoff, concorrência, reinício, SLA, reabertura, indisponibilidade, escopo, impacto, aplicabilidade da VPN, limites de sessão, contrato Gemini, orçamento e roteamento semântico pelo grafo.

Para validar o LLM real, configure a chave, inicie uma conversa e pergunte “Quais registros de suporte existem em meu nome?”. Expanda a auditoria: deve conter “Triagem Gemini”, a intenção e a evidência, além dos tickets próprios. Teste também uma dúvida de senha e um caso ambíguo. Uma resposta apenas determinística ou um erro do provedor não valida esse caminho. Não foi feita avaliação com chave real nesta revisão.

A interface conserva os seis layouts do Pen, incluindo rascunho editável, auditoria e estados de carregamento/erro. Atualizações entre funcionário/analista usam polling de três segundos; não há streaming por token. O perfil mostra dados reais da sessão, mas recuperação de senha apenas orienta o contato com a TI. Indicadores do login são ilustrativos.

## Configuração e deploy

Todas as variáveis estão em [.env.example](.env.example):

| Variável | Uso |
|---|---|
| `PORT`, `DATA_FILE` | Porta e arquivo do desenvolvimento local. |
| `DATABASE_URL` | PostgreSQL Neon; obrigatório na Vercel. O schema/seed é inicializado no primeiro acesso. |
| `SESSION_SECRET` | Assinatura de sessões de 24h. Obrigatório na Vercel, mínimo 32 caracteres. |
| `ANALYST_PASSWORD` | Senha de acesso ao console. Obrigatória na Vercel, mínimo 16 caracteres. |
| `ALLOW_DEMO_SIGNUP` | Permitir novos perfis locais. Na Vercel, sempre desativado. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Provedor e modelo; padrão `gemini-2.5-flash-lite`. |
| `LLM_DAILY_LIMIT` | Teto de chamadas por dia UTC, persistido e compartilhado; padrão 100, zero bloqueia. |
| `LEGACY_OUTAGE_MS` | Indisponibilidade simulada após iniciar cada processo; padrão zero. Use 2000 para exercitar recuperação. |

O projeto inclui [vercel.json](vercel.json), função em `api/index.ts` e adaptador Neon. O frontend usa Vite e a função Express recebe `/api`; as demais rotas carregam a SPA. O build é `npm run build`, saída `dist`, Node 22.x. Configure as variáveis de servidor antes de publicar. Não use prefixo `VITE_` em segredos nem tente persistir dados no disco temporário da Vercel. Nenhum deploy foi publicado nesta revisão.

Proteções para a demonstração: até 30 mensagens/conversa, 10 novas conversas por funcionário/24h, até 100 chamadas LLM/dia por padrão, contexto de quatro mensagens anteriores, saída de 350 tokens e timeout de 10s. O teto do modelo é persistido no mesmo banco e funciona entre instâncias. São limites de aplicação, não garantia de gasto zero fora do free tier nem proteção completa contra abuso.

## Trade-offs e próximos passos

- O calendário considera segunda–sexta, 08h–18h, UTC−03; um dia útil equivale a dez horas de atendimento. Não há feriados. Críticos vencem em uma hora corrida, inclusive fins de semana.
- A deduplicação lexical foi tornada conservadora: tipo/categoria iguais, ao menos duas palavras relevantes e sobreposição mínima de 60%. Pode deixar de reconhecer paráfrases ou unir descrições muito parecidas de ativos diferentes. Evoluir para matching semântico com confirmação do ticket candidato.
- O snapshot JSONB simplifica a migração da demonstração, mas regrava todo o estado. Para volume real: tabelas normalizadas, migrações, transações de domínio, índices, retenção e backup. O arquivo local admite apenas um processo.
- A gravação do ticket e a persistência da resposta do agente ainda ocorrem em operações separadas. Uma interrupção entre elas pode exigir consultar o ticket e reconciliar a conversa; uma próxima evolução deve adicionar recibos idempotentes/transação de confirmação.
- O login de funcionário com qualquer senha é exclusivamente demonstrativo. Tokens assinados isolam as contas, mas não comprovam identidade; em produção seria necessário SSO, funções e autenticação forte.
- A falha simulada do legado ocorre antes da escrita e tenta recuperação com backoff limitado. Falhas de rede de resultado incerto não são repetidas automaticamente pelo armazenamento remoto.
- O modelo tem contrato e fallback testados com mocks. Ainda faltam avaliação semântica com casos reais anonimizados, teste real Neon/Vercel e medição de latência. A confiança do modelo é declarada, não uma probabilidade calibrada.

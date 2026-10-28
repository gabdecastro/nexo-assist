# Nexo Assist

Protótipo local de service desk com chat para funcionários, agent de TI auditável, serviço simulado de chamados e console de analista.

## Rodar localmente

Requisitos: Node.js 20 ou mais recente e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra <http://localhost:5173>. O primeiro acesso cria `data/db.json` com funcionários, artigos e chamados de demonstração. Esse arquivo persiste conversas, rascunhos, estado de atendimento e tickets entre reinícios. Para reiniciar a demonstração do zero, pare o servidor e remova `data/db.json`.

Entre como funcionário com `ana.souza@nexo.com.br` e qualquer senha; o endereço anterior `ana.souza@nexo.com` é aceito como alias da mesma conta. Também há `marcos.lima@nexo.com`, `julia.costa@nexo.com` e `paulo.mendes@nexo.com`. E-mails desconhecidos criam perfis isolados de demonstração. Use “Acessar console do analista” ou abra `/analyst` para acessar como Rafael Lima, Suporte N2 (qualquer senha).

Para compilar a aplicação: `npm run build`. Em desenvolvimento, Vite atende a interface e encaminha `/api` para Express na porta 3001.

## Arquitetura

- `src/ui/Login.tsx`, `EmployeeWorkspace.tsx`, `AnalystWorkspace.tsx`: telas React de login, chat/perfil e console.
- `src/ui/components`: logo vetorial, elementos comuns, decisões, seleção de tickets e rascunho editável.
- `src/ui/styles.css`: tokens e layout extraídos de `design/nexo.pen`, com adaptação para celular.
- `server/agent.ts`: classificador e fluxo determinístico; mantém contexto de rascunhos e produz auditoria para cada decisão.
- `server/ticket-service.ts`: serviço de chamados separado do agent, com classificação, deduplicação, atualização, reabertura e prazo.
- `server/store.ts`: persistência JSON atômica, com dados iniciais de exemplo.
- `server/index.ts`: API HTTP, validação das sessões assinadas e autorização por papel. As rotas de funcionário filtram chamados no servidor pela identidade da sessão.
- `spec.md`: requisitos, histórias, regras, arquitetura e critérios de aceite que conduziram a implementação.
- `design/nexo.pen`: referência visual fornecida pelo usuário, com seis telas; apenas o identificador de compartilhamento foi removido.
- `tests/workflows.test.mjs`: testes de integração dos fluxos de interface/API, usando dados temporários isolados.

## Como o agent decide

O protótipo usa regras locais explícitas, sem chamada a LLM ou custo por mensagem. A ordem é: validar estado e limite da conversa; respeitar pedido humano mesmo durante a preparação de um rascunho; resolver confirmação/cancelamento; tratar consulta de tickets próprios; reconhecer abertura de chamado e classificar tipo/categoria/prioridade; redirecionar assuntos fora de TI; buscar o artigo com melhor correspondência de tags; por fim, pedir esclarecimento. Um ticket completo nunca é persistido sem confirmação explícita. O serviço detecta sobreposição com tickets abertos para atualizar em vez de duplicar e reconhece resolvidos nos últimos sete dias.

As decisões do agent incluem intenção, ação, evidências, nível de confiança, motivo e resultado. Clique nas ações acima da resposta para expandir o detalhe. Na consulta, o usuário primeiro escolhe seu chamado e recebe a oferta de transferência se o prazo estiver vencido, conforme o Pen. Pedidos explícitos de analista e casos críticos são transferidos. Durante a fila/atendimento humano, mensagens do funcionário são salvas para o analista, sem resposta automática do agent.

## Interface e verificação

O arquivo Pen orienta as seis telas: identificação, novo chamado, consulta/transferência, console aguardando, console assumido e perfil. A interface usa o logo vetorial original, azul de ação `#0062C4` e as fontes Schibsted Grotesk, Newsreader e IBM Plex Mono, servidas localmente via Fontsource. Não depende de Google Fonts em tempo de execução.

O perfil exibe os dados da sessão. O botão de recuperação orienta ligar no ramal 4000 e explica que o ambiente não envia e-mails. Os indicadores do login são exemplos do protótipo, não métricas de produção.

```bash
npm run build
npm run test:integration
```

Os testes iniciam a API em uma porta temporária, usam outro arquivo de persistência e o removem ao concluir. Cobrem autorização de chamados/rascunhos, edição sem criação prematura, confirmação, handoff, mensagens simultâneas, encerramento e persistência após reinício.

## Qualidade, segurança e trade-offs

- TypeScript estrito, módulos separados e limite de tamanho/validação nos endpoints de mensagem.
- Token de sessão assinado pelo servidor; funcionário não escolhe `ownerId` no corpo da consulta de tickets. Sessões demo duram no navegador e são verificadas em cada rota.
- Serviço legado simulado lê/grava JSON; gravação por arquivo temporário + rename evita substituição parcial, e uma fila serializa mutações dentro do processo. Não é banco multi-instância nem substitui transações/backup.
- A interface demonstra login por qualquer senha, conforme o desafio. Esse comportamento e o login simplificado de analista são apenas demonstração, não autenticação de produção.
- A prioridade e correspondência são determinísticas e baratas, mas não têm a flexibilidade semântica de um LLM. Casos ambíguos pedem esclarecimento; em uma próxima etapa eu adicionaria um classificador estruturado com saída validada, avaliações offline das regras, telemetria sem dados sensíveis e fallback para analista.
- Prazos são aproximados no protótipo. O cálculo simples usa horas corridas; produção precisaria de calendário de dias úteis/feriados, relógio de SLA por atualização e política de plantão.
- O Pen foi fornecido como arquivo e está em `design/nexo.pen`. Adaptações necessárias para dados reais, telas pequenas e recuperação de senha estão descritas na spec.

## Configuração

Copie `.env.example` para `.env`. `PORT` escolhe a porta da API e `DATA_FILE` pode apontar o arquivo de persistência. `SESSION_SECRET` pode ser definido com um valor aleatório para trocar a chave de assinatura local. Não coloque chaves no código ou no cliente.

## Próximos passos

Para produção: autenticação corporativa, banco transacional, implantação com TLS, controle de acesso por função, trilha de auditoria protegida, calendário de SLA, monitoramento, limitação de uso e testes de autorização/deduplicação. O deploy é opcional no desafio e não foi configurado neste protótipo local.

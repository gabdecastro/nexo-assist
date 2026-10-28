# Nexo Assist — Especificação do produto

**Status:** protótipo implementado; interface revisada a partir do arquivo Pen  
**Fonte de requisitos:** `Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf` (PRD, anexos A–C).  
**Referência visual:** `design/nexo.pen`, extraído do `nexo.zip` fornecido pelo usuário.  
**Objetivo:** construir um assistente de service desk de TI que resolva dúvidas no chat, consulte e mantenha chamados sem duplicidade e transfira conversas para analistas quando solicitado ou necessário.

## 1. Escopo

### Incluído

- Login de demonstração com e-mail corporativo e senha; funcionários de exemplo e outros e-mails podem entrar com qualquer senha.
- Chat persistente do funcionário, até 30 mensagens por sessão, com respostas, opções rápidas, cards de chamado, rascunhos e confirmação explícita antes de criar/atualizar.
- Agent de TI que usa artigos da central de ajuda e um serviço simulado de chamados separado da lógica de decisão.
- Consulta de chamados próprios, situação do prazo e oferta de transferência.
- Console de analista com fila, filtros, histórico, assumir, devolver ao agent e encerrar.
- Perfil do funcionário com dados de acesso e orientação de recuperação de senha.
- Auditoria legível das decisões do agent: intenção, ação, dados considerados, confiança, motivo e resultado.
- Dados de exemplo persistidos em arquivo local, incluindo chamados de outros funcionários para validar isolamento.

### Fora do escopo

- Integração com modelo/provedor externo, SSO, notificações, banco remoto e deploy público.
- Autenticação de produção. O login solicitado pelo desafio é deliberadamente de demonstração.

## 2. Papéis e permissões

| Papel | Acesso |
|---|---|
| Funcionário | Sua conversa, chamados próprios e artigos públicos de TI. Nunca consulta chamados de outro funcionário. |
| Analista | Fila compartilhada de transferências, conversas transferidas e contexto dos chamados associado à conversa. Pode assumir, devolver ou encerrar. |

O modo analista de demonstração é acessado em `/analyst`. A interface do funcionário recebe a identidade de sessão e não escolhe o proprietário de um chamado por payload.

## 3. Histórias e fluxos

### Login

1. Funcionário informa e-mail e senha.
2. A sessão identifica um funcionário de exemplo pelo e-mail; e-mails desconhecidos recebem perfil de demonstração isolado.
3. A pessoa chega à conversa persistida mais recente ou inicia uma conversa.

### Dúvida e consulta

1. Funcionário descreve uma dúvida de TI ou pede o status de um chamado.
2. O agent classifica a intenção e busca artigos/chamados próprios relevantes.
3. Dúvida respondível: resposta cita o artigo e registra evidências. Falta de informação: pergunta objetiva com opções rápidas. Baixa confiança, pedido explícito ou incidente crítico: transfere.
4. Consulta exibe os chamados próprios com situação, prioridade e vencimento; chamado vencido oferece analista.

### Abertura e atualização

1. O agent coleta título, descrição, tipo, categoria, impacto/urgência e afetado; pergunta o que faltar.
2. INC significa algo que parou/não funciona. REQ significa pedido de acesso, equipamento ou software.
3. A classificação de prioridade considera impacto e urgência. O agent exibe prazo e um rascunho completo.
4. Somente uma mensagem afirmativa de confirmação executa a ação. Negação cancela; edição atualiza o rascunho.
5. Um problema equivalente em chamado aberto atualiza o existente. Chamado resolvido nos últimos sete dias pode reabrir. Outros casos criam um novo ticket.

### Transferência e atendimento humano

1. Transferência ocorre por pedido explícito, incidente crítico, chamado vencido ou confiança baixa.
2. O resumo e o histórico acompanham a conversa; estado muda para `waiting_human` e o agent não envia respostas.
3. Analista assume: estado `human_active`, agent pausado. Analista pode devolver ao agent (`assistant_active`) ou encerrar (`closed`).
4. Interface informa o estado. O funcionário pode acrescentar mensagens na fila e conversar com o analista; o agent permanece pausado.
5. Analista pode devolver uma conversa aguardando atendente ao agent sem assumir, conforme o protótipo. Encerramento exige atendimento assumido.

## 4. Regras do service desk

- Tipos: `INC` (incidente) e `REQ` (requisição).
- Categorias: Acesso, Rede e VPN, Hardware, Software, E-mail e Outros.
- Todo chamado tem título, descrição, tipo, categoria, prioridade e pessoa afetada.
- Prioridades e prazo de primeira resposta/atualização: Crítica — 1 hora; Alta — 4 horas úteis; Média — 3 dias úteis; Baixa — 5 dias úteis.
- Crítica: equipe/empresa parada. Alta: pessoa impedida de trabalhar ou compromisso no mesmo dia. Média: atrapalha com alternativa. Baixa: pedido/melhoria sem urgência.
- Não duplicar chamados abertos do mesmo problema. Reabrir resolvidos há até sete dias.
- Só tratar assuntos de TI; RH, financeiro e facilities são redirecionados.
- Dados de chamados são privados ao proprietário.
- Sistema legado pode falhar temporariamente: erros são apresentados sem perder rascunho ou mensagem; leituras/escritas podem ser repetidas.

## 5. Requisitos funcionais

| ID | Requisito |
|---|---|
| F-01 | Login de demonstração por e-mail e senha. |
| F-02 | Conversa e mensagens sobrevivem ao reinício. |
| F-03 | Limite de 30 mensagens por sessão e estado claro ao atingir o limite. |
| F-04 | Resposta em andamento, erro recuperável e opções rápidas são visíveis. |
| F-05 | Agent pesquisa 5–10 artigos curtos antes de responder dúvidas. |
| F-06 | Agent consulta chamados do usuário autenticado apenas. |
| F-07 | Abertura/atualização requer confirmação explícita de rascunho completo. |
| F-08 | Serviço de tickets é módulo independente do agent e suporta listar/criar/atualizar/reabrir. |
| F-09 | Transferência pausa agent e guarda contexto. |
| F-10 | Console lista/filtro conversas, assume, devolve, encerra e mostra chamados. |
| F-11 | Respostas incluem ações e auditoria expandível. |
| F-12 | Conversas, chamados e estado persistem em reinício. |
| F-13 | UI segue as seis telas de `design/nexo.pen`, incluindo cores, fontes, logo vetorial, dimensões de referência e disposição dos componentes. |
| F-14 | Perfil exibe dados da sessão e orientação para recuperação de senha, sem simular envio real de e-mail. |
| F-15 | Rascunho estruturado oferece Confirmar, Editar e Cancelar; edição persiste apenas o rascunho até a confirmação. |
| F-16 | Console permite buscar por pessoa/chamado, filtrar Todas/Para você/Com o agent/Minhas, pesquisar mensagens e abrir detalhes dos chamados. |

## 6. Requisitos não funcionais

- TypeScript estrito, separação entre interface, agent, serviço de tickets e persistência.
- Sem chave secreta embutida no cliente. `.env.example` documenta configuração.
- Tratamento de erro nas chamadas ao serviço de tickets simulado.
- Inicialização local com poucos comandos e instruções no README.
- Respostas determinísticas locais evitam custo e latência de LLM; decisões e regras são inspecionáveis.

## 7. Modelo de dados

- `Employee`: `id`, `name`, `email`, `department`.
- `Ticket`: `id`, `ownerId`, `affectedPerson`, `title`, `description`, `type`, `category`, `priority`, `status`, `createdAt`, `updatedAt`, `dueAt`, `history[]`.
- `Conversation`: `id`, `ownerId`, `status`, `messages[]`, `draft?`, `createdAt`, `updatedAt`, `assignedAnalyst?`.
- `Message`: `id`, `role` (`user`, `assistant`, `analyst` ou `system`), `content`, `createdAt`, `quickReplies?`, `ticketCard?`, `draftCard?`, `audit?`.
- `Audit`: `intent`, `action`, `evidence[]`, `confidence`, `reason`, `outcome`.

## 8. Arquitetura proposta

React + Vite para interface; API HTTP Node/Express em TypeScript; `AgentService` determinístico; `TicketService` isolado como serviço simulado; repositório JSON atômico em `data/db.json`, com fila de escrita para serializar alterações locais. A UI acessa a API, não as regras diretamente. A identidade de funcionário é mantida no estado da aplicação de demonstração e validada pelo servidor em operações de tickets. Conversas são atualizadas a cada três segundos nas telas abertas.

## 9. Critérios de aceite

1. Login, conversa, mensagens e tickets funcionam depois de reiniciar o servidor.
2. Uma pergunta sobre VPN encontra artigo e responde com ação/evidência rastreável.
3. Mensagem não relacionada a TI é redirecionada sem abrir ticket.
4. Pedido de abertura pergunta dados faltantes, mostra prioridade/prazo e espera confirmação antes de persistir.
5. Problema aberto semelhante é atualizado, não duplicado; ticket de outro usuário não aparece.
6. Pedido de analista e incidente crítico entram na fila e silenciam o agent.
7. Analista assume, devolve e encerra conversa; estado é refletido para funcionário.
8. O console expõe contexto, histórico, tickets e auditoria suficiente para entender decisões.
9. Limite de mensagens é respeitado e erro do serviço simulado é visível sem descarte do texto enviado.

## 10. Decisões e pendências

- A referência inicial do Anexo C foi substituída pelo arquivo completo `nexo.pen`, fornecido em 28/10/2026. Seus dados ilustrativos não substituem os dados reais da sessão.
- O cálculo de prazo ainda usa horas corridas. O calendário de segunda–sexta, 08h–18h e feriados permanece pendente.
- A aplicação é um protótipo local. Login demonstrativo e persistência em arquivo devem ser substituídos por identidade corporativa, banco transacional, controle de acesso e observabilidade antes de uso real.

## 11. Especificação visual do Pen

| Tela | Implementação e dimensões de referência |
|---|---|
| Identificação | Layout 1440 × 900; apresentação escura de 800 px e formulário de 640 px. Título editorial, conversa ilustrativa, indicadores e formulário de 380 px. |
| Novo chamado | Sidebar branca de 232 px, barra superior de 64 px e conversa central de até 808 px. Mensagem do funcionário em `#1B2431`; resposta branca com borda; rascunho com ações na base. |
| Consulta e transferência | Mesmo layout do chat; lista de seleção, card com dados e prazo, oferta de atendimento humano. |
| Console aguardando | Rail de 64 px, lista de 380 px, conversa flexível sobre `#EEF1F5` e painel de chamados de 340 px. Composer bloqueado para o analista antes de assumir. |
| Console assumido | Mesma estrutura; ações Devolver e Encerrar no cabeçalho, mensagens humanas e composer habilitado. |
| Meu perfil | Mesma sidebar do funcionário; conteúdo central de 600 px, cards com borda e raio de 16 px. |

**Tokens:** papel `#FFFFFF`, mesa `#F6F7F9`, tinta `#1B2431`, texto secundário `#3D4656`, texto auxiliar `#5B6472`, borda `#E6E8EC`, ação principal `#0062C4`. Fontes locais: Schibsted Grotesk para interface, Newsreader para títulos editoriais e IBM Plex Mono para identificadores. O logo SVG usa a geometria vetorial do arquivo original.

**Adaptação:** abaixo de 1101 px o painel do console abre sobre a conversa; abaixo de 781 px a fila e o atendimento usam navegação entre telas, e a sidebar do funcionário abre por menu. Conteúdo e ações continuam acessíveis em telas de 320 px ou mais.

**Comportamento adicional:** histórico acessível no cabeçalho do funcionário; nova conversa disponível no histórico, no encerramento e no limite de 30 mensagens. Dados pessoais são da sessão, e os indicadores na apresentação do login são identificados como ilustrativos. Recuperação de senha orienta o contato com a TI, pois não há provedor de identidade/e-mail conectado.

## 12. Verificação da revisão visual

- `npm run build`: TypeScript estrito de frontend/backend e bundle Vite.
- `npm run test:integration`: quatro cenários contra uma API e um arquivo de dados temporários; cobre aliases de login, isolamento, seleção de chamado, edição/validação do rascunho, confirmação, troca de mensagens com agent pausado, escrita concorrente, devolução, encerramento e reinício.
- As verificações automatizadas exercitam comportamento. A correspondência visual é revisada com as propriedades e medidas do arquivo Pen e inspeção no navegador.

# Revisão de aderência ao desafio

Referências: PRD v5 (arquivo local `Nexo_Assist_PRD_v5.pdf`, mesmo título do documento originalmente informado), anexos A–C, e `design/nexo.pen`. Revisão realizada em 28/10/2026. O PDF estabelece requisitos do produto; não é autorização para publicar o projeto.

## Achados da revisão inicial

1. **Bloqueador — framework/LLM:** agente exclusivamente determinístico; a spec excluía indevidamente uma exigência técnica do PDF.
2. **Alta — SLA:** prazos altos/médios/baixos calculados em horas corridas, ignorando dias úteis e expediente.
3. **Alta — tickets:** uma palavra em comum podia unir problemas diferentes; reabertura perdia histórico; identificadores podiam colidir.
4. **Alta — escopo/contexto:** pedido fora de TI podia virar rascunho; baixa confiança não transferia; resumo humano não era explícito.
5. **Alta — hospedagem:** JSON local não é armazenamento durável em funções serverless; entrada HTTP precisava separar app e listener.
6. **Média — resiliência:** indisponibilidade transitória do legado não era simulada nem exercitada.
7. **Média — entrega:** configuração incompleta de ambiente; nenhuma proteção para os custos de LLM em um deploy.

## Evidências iniciais

Build TypeScript/Vite aprovado e quatro testes de integração aprovados antes das correções. Cobertura existente: privacidade de tickets/rascunhos, confirmação, troca com analista, concorrência local, encerramento e reinício.

## Histórico local

O repositório chegou a esta revisão sem commits. Os primeiros 14 commits organizam retrospectivamente os arquivos existentes por etapa lógica: especificação, infraestrutura, domínio, persistência, tickets, agente, API, UI compartilhada, login, funcionário, analista, Pen, testes e README. Não representam snapshots antigos recuperados; usam datas reais da revisão. As correções subsequentes são incrementais e registradas separadamente. Nenhum push ou deploy é parte desta tarefa.

## Resultado e rastreabilidade

| Requisito / achado | Resultado da revisão | Evidência |
|---|---|---|
| TypeScript estrito / separação | Atendido no build de frontend, backend e função | tsconfigs; `npm run test:integration` |
| LangGraph.js e provedor LLM | Implementados; caminho real ainda sem validação com chave | `agent.ts`, `llm.ts`, testes de contrato e roteamento com mock |
| Login demo e privacidade | Contas seed/aliases, tokens de 24h, filtro de proprietário | testes de workflows |
| Rascunho / confirmação | Campos obrigatórios e impacto antes da escrita; edição privada | workflows de edição e impacto |
| SLA | Corrigido: expediente/dias úteis e plantão | `sla.test.mjs`; sem feriados |
| Duplicidade / reabertura | Corrigidos matching amplo, colisão de IDs e perda de histórico | `tickets.test.mjs`; matching continua lexical |
| Escopo / VPN / baixa confiança | TI antes de criar; pergunta versão de SO; transfere incerteza com resumo | workflows de escopo, impacto e VPN |
| Handoff e console | Pausa, mensagens humanas, resumo, assumir/devolver/encerrar persistidos | workflows e componentes do console |
| Ticket vencido | Oferta de transferência ao selecionar, conforme Pen | **Interpretação pendente:** Anexo A também sugere transferência automática |
| Legado indisponível | Falha configurável antes da operação, três tentativas limitadas e erro recuperável | teste de indisponibilidade |
| Persistência após reinício | Validada localmente | workflow de restart |
| Persistência serverless | Adaptador Neon e comparação de versão implementados | CAS concorrente testado com driver em memória; banco real não testado |
| Auditoria | Decisões e evidência de triagem do provedor visíveis | testes de grafo, componentes de mensagens |
| Respostas em tempo real | Resposta HTTP e atualização humana por polling de 3s | Sem streaming por token; avaliar latência real |
| Limite de 30 mensagens | Enforced no servidor, inclusive durante atendimento humano | teste de mensagem 31 |
| Deploy opcional / custo | Configuração pronta, segredos de servidor, cadastro fechado, limites de conversa/modelo | Guia local ignorado; sem publicação |
| Visual Pen | Seis telas preservadas nesta revisão | Nenhuma alteração visual; não foi refeita uma inspeção pixel a pixel |

## Limitações materiais remanescentes

- Matching lexical não garante equivalência semântica entre problemas; casos ambíguos precisam de validação humana/matching melhor.
- Criação do ticket e registro da resposta não formam uma única transação. Uma interrupção nesse intervalo pode exigir reconciliação e a repetição de confirmação não tem recibo idempotente dedicado.
- O snapshot remoto evita perda por sobrescrita, mas não é uma modelagem adequada à escala de 2.000 funcionários. Arquivo local suporta um processo; Neon real ainda deve ser testado.
- Login demo não comprova identidade. Proteções de custo são limites locais de aplicação, não uma solução completa de autenticação/rate limiting.
- Avaliação de semântica/confiança do LLM e infraestrutura externa não foi executada sem credenciais; testes com mock não comprovam qualidade do modelo real.
- Não foi publicado repositório remoto nem realizado deploy, conforme o escopo pedido de commits locais e guia.

## Verificação de entrega

Executar `npm run test:integration` compila a aplicação e executa todos os testes. O guia `DEPLOY_VERCEL.local.md` deve aparecer em `git check-ignore` e não em `git ls-files`. O histórico pode ser revisado com `git log --reverse --oneline`. O estado final de testes e Git é verificado ao concluir a revisão.

Resultado local desta revisão: **build aprovado e 21 testes aprovados**. `git diff --check` sem problemas; guia confirmado como ignorado e ausente do índice. Credenciais externas e deploy não foram utilizados.

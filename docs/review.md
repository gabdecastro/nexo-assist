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

import { newId, timestamp, mutateDb, readDb } from './store.js';
import { classifyTicket, TicketService } from './ticket-service.js';
import type { Audit, Conversation, Draft, Message } from './types.js';

const tickets = new TicketService();
const makeMessage = (role: Message['role'], content: string, extra: Partial<Message> = {}): Message => ({ id: newId('msg'), role, content, createdAt: timestamp(), ...extra });

function categoryFrom(text: string) { return classifyTicket(text).category; }
function makeAudit(intent: string, action: string, evidence: string[], confidence: number, reason: string, outcome: string): Audit { return { intent, action, evidence, confidence, reason, outcome }; }

export class AgentService {
  async respond(conversationId: string, ownerId: string, input: string): Promise<Conversation> {
    const conversation = await mutateDb(db => {
      const found = db.conversations.find(c => c.id === conversationId && c.ownerId === ownerId);
      if (!found) throw new Error('Conversa não encontrada.');
      if (found.status === 'closed') throw new Error('Esta conversa foi encerrada. Inicie um novo atendimento.');
      const userMessages = found.messages.filter(m => m.role === 'user').length;
      if (userMessages >= 30) throw new Error('Esta sessão atingiu o limite de 30 mensagens. Inicie uma nova conversa para continuar.');
      found.messages.push(makeMessage('user', input)); found.updatedAt = timestamp(); return found;
    });
    // The employee can continue talking to the analyst while the agent is paused.
    if (conversation.status !== 'assistant_active') return conversation;
    const text = input.trim();
    const lower = text.toLocaleLowerCase('pt-BR');
    const employee = (await readDb()).employees.find(e => e.id === ownerId);
    if (!employee) throw new Error('Funcionário não encontrado.');
    const reply = await this.decide(conversation, employee, text, lower);
    return mutateDb(db => {
      const found = db.conversations.find(c => c.id === conversationId && c.ownerId === ownerId);
      if (!found) throw new Error('Conversa não encontrada.');
      found.messages.push(reply); found.updatedAt = timestamp();
      return found;
    });
  }
  private async decide(conversation: Conversation, employee: { id: string; name: string }, text: string, lower: string): Promise<Message> {
    if (/falar com (um )?analista|quero (um )?analista|quero falar com alguém|^(atendente|humano|transferir)$/.test(lower)) {
      await this.transfer(conversation.id);
      return makeMessage('assistant', 'Encaminhei sua conversa para o service desk. O analista receberá o histórico e os chamados relacionados. Você pode acrescentar informações enquanto aguarda.', { audit: makeAudit('pedir_analista', 'transferir_conversa', [text], 0.99, 'A pessoa solicitou atendimento humano.', 'Conversa na fila; agent pausado.') });
    }
    if (/^adicionar informação$/i.test(text)) {
      const ticket = conversation.messages.slice().reverse().find(message => message.ticketCard)?.ticketCard;
      if (ticket && ticket.ownerId === employee.id) {
        await mutateDb(db => { const c = db.conversations.find(item => item.id === conversation.id); if (c) c.draft = { title: ticket.title, type: ticket.type, category: ticket.category, priority: ticket.priority, affectedPerson: ticket.affectedPerson, existingTicketId: ticket.id }; });
        return makeMessage('assistant', `O que você gostaria de acrescentar ao ${ticket.id}? Vou mostrar um rascunho antes de atualizar o chamado.`, { audit: makeAudit('atualizar_chamado', 'coletar_dados', [ticket.id], 0.98, 'O funcionário escolheu complementar um chamado próprio.', 'Aguardando novas informações.') });
      }
    }
    if (/^não, obrigado[.!]?$/i.test(text)) return makeMessage('assistant', 'Tudo bem. Se precisar de mais alguma coisa de TI, é só me contar.');
    const pending = conversation.draft;
    if (pending && /^(sim|confirmo|confirmar|confirmar e enviar|pode criar|pode abrir|isso|ok|certo|pode atualizar)$/i.test(text.trim())) {
      if (!pending.title || !pending.description || !pending.type || !pending.category || !pending.priority || !pending.affectedPerson) {
        return makeMessage('assistant', 'Ainda faltam alguns dados para montar o chamado. Qual é o impacto e existe um compromisso em risco hoje?', { quickReplies: ['Só eu estou afetado', 'Minha equipe está parada', 'Tenho um compromisso hoje'], audit: makeAudit('completar_chamado', 'solicitar_dados', ['Rascunho incompleto'], 0.93, 'Todo chamado precisa de título, descrição, tipo, categoria, prioridade e pessoa afetada.', 'Nenhum chamado foi criado.') });
      }
      const result = await tickets.createOrUpdate(employee.id, { ...pending, title: pending.title, description: pending.description, type: pending.type, category: pending.category, priority: pending.priority, affectedPerson: pending.affectedPerson });
      const audit = makeAudit(result.updated ? 'atualizar_chamado' : 'abrir_chamado', result.updated ? 'atualizar_ticket' : 'criar_ticket', [pending.title, pending.category, pending.priority], 0.97, 'A pessoa confirmou o rascunho e a política impede duplicidade.', `${result.ticket.id} ${result.updated ? 'atualizado' : 'criado'} com sucesso.`);
      const updated = await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = undefined; return c; });
      void updated;
      return makeMessage('assistant', `Pronto. O chamado ${result.ticket.id} foi ${result.updated ? 'atualizado' : 'aberto'} e está ${result.ticket.status.toLocaleLowerCase('pt-BR')}. Prazo para primeira resposta: ${result.ticket.priority === 'Crítica' ? '1 hora' : result.ticket.priority === 'Alta' ? '4 horas úteis' : result.ticket.priority === 'Média' ? '3 dias úteis' : '5 dias úteis'}.`, { ticketCard: result.ticket, audit });
    }
    if (pending && /^(não|nao|cancelar|deixa|deixa pra lá)$/i.test(text.trim())) {
      await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = undefined; });
      return makeMessage('assistant', 'Tudo bem, cancelei o rascunho. Nada foi alterado.', { audit: makeAudit('cancelar_chamado', 'descartar_rascunho', [], 0.99, 'A pessoa não confirmou a ação.', 'Nenhum chamado foi alterado.') });
    }
    if (pending && !/^(sim|confirmo|confirmar|confirmar e enviar|pode criar|pode abrir|isso|ok|certo|pode atualizar|não|nao|cancelar)$/i.test(text.trim())) {
      const choicePriority = /minha equipe está parada|equipe inteira|todos pararam/.test(lower) ? 'Crítica' : /compromisso hoje|impede meu trabalho/.test(lower) ? 'Alta' : /tenho alternativa|só eu estou afetado/.test(lower) ? 'Média' : undefined;
      const choiceCategory = /acesso|equipamento|software/.test(lower) ? 'REQ' : undefined;
      const firstDetails = !pending.title;
      const inferred = firstDetails ? classifyTicket(text) : undefined;
      const draft = { ...pending,
        ...(firstDetails ? { title: text.length > 90 ? `${text.slice(0,87)}...` : text, type: inferred?.type, category: inferred?.category, priority: inferred?.priority } : {}),
        description: firstDetails || choicePriority || choiceCategory ? (pending.description ? `${pending.description}\n${text}` : text) : `${pending.description ?? ''}\n${text}`.trim(),
        ...(choicePriority ? { priority: choicePriority as Draft['priority'] } : {}),
        ...(choiceCategory ? { type: 'REQ' as const } : {})
      };
      await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = draft; });
      if (draft.priority === 'Crítica') {
        await this.transfer(conversation.id);
        return makeMessage('assistant', 'A equipe parece parada. Encaminhei o caso como prioridade crítica para o plantão 24 horas. O agent ficará pausado enquanto o service desk acompanha.', { audit: makeAudit('classificar_criticidade', 'transferir_conversa', [draft.title ?? '', text], 0.93, 'Impacto informado indica interrupção de uma equipe; a regra exige atendimento humano crítico.', 'Fila do plantão; agent pausado.') });
      }
      return this.draftMessage(draft, 'Atualizei a descrição com o que você contou. Confira e confirme para continuar.');
    }
    if (/^(falar com (um )?analista|quero (um )?analista|atendente|pessoa|humano|transferir)$/i.test(text.trim()) || /falar com analista|quero falar com alguém/.test(lower)) {
      await this.transfer(conversation.id);
      return makeMessage('assistant', 'Encaminhei a conversa ao service desk. Um analista poderá ver este histórico e continuar o atendimento; vou aguardar por aqui.', { audit: makeAudit('pedir_analista', 'transferir_conversa', [text], 0.99, 'A pessoa solicitou atendimento humano.', 'Fila do service desk; agent pausado.') });
    }
    if (/^(ver )?(meus )?(chamados|tickets|status dos chamados|status)$/i.test(text.trim()) || /meus chamados|status do (meu )?chamado|chamado atrasado|chamados abertos/.test(lower)) {
      const own = await tickets.listFor(employee.id);
      return makeMessage('assistant', own.length ? `Encontrei ${own.length} chamado(s) seu(s). Selecione um para ver o status, o prazo ou falar com um analista.` : 'Você não tem chamados registrados no momento.', { quickReplies: own.map(t => t.id), audit: makeAudit('consultar_chamados', 'listar_tickets', own.map(t => `${t.id}: ${t.status}`), 0.98, 'Consulta filtrada pelo funcionário autenticado.', 'Nenhum chamado de outra pessoa foi consultado.') });
    }
    const own = await tickets.listFor(employee.id); const selected = own.find(t => t.id.toLowerCase() === lower.trim() || lower.includes(t.id.toLowerCase()));
    if (selected) return makeMessage('assistant', Date.parse(selected.dueAt) < Date.now() && selected.status !== 'Resolvido' ? 'Este chamado está com o prazo de atualização vencido. Quer que eu chame um analista?' : 'Encontrei seu chamado. Confira abaixo o status e a última atualização.', { ticketCard: selected, quickReplies: ['Falar com analista', 'Adicionar informação', 'Não, obrigado'], audit: makeAudit('consultar_chamado', 'mostrar_ticket', [selected.id, selected.status], 0.99, 'O chamado pertence à pessoa autenticada.', 'Status e prazo exibidos; transferência disponível.') });

    if (/^(abrir chamado|criar chamado|novo chamado|confirmar e enviar)$/i.test(text.trim())) {
      const draft: Draft = { affectedPerson: employee.name };
      await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = draft; });
      return makeMessage('assistant', 'Claro. O que aconteceu ou o que você precisa solicitar? Conte também se isso impede seu trabalho ou coloca um compromisso de hoje em risco.', { quickReplies: ['É um pedido de acesso/equipamento', 'Impede meu trabalho', 'Tenho alternativa'], audit: makeAudit('abrir_chamado', 'coletar_dados', [], 0.9, 'O funcionário iniciou um chamado; faltam detalhes para classificar corretamente.', 'Nenhum chamado criado; aguardando descrição e impacto.') });
    }
    if (/abrir chamado|criar chamado|preciso de ajuda|problema|não funciona|nao funciona|parou|solicitar|preciso de um|preciso de acesso/.test(lower)) {
      const classification = classifyTicket(text); const title = text.length > 90 ? `${text.slice(0, 87)}...` : text;
      const draft: Draft = { title, description: text, ...classification, affectedPerson: employee.name };
      await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = draft; });
      if (draft.priority === 'Crítica') {
        await this.transfer(conversation.id);
        return makeMessage('assistant', 'A equipe parece parada. Encaminhei o caso como prioridade crítica para o plantão 24 horas. O agent ficará pausado enquanto o service desk acompanha.', { audit: makeAudit('classificar_criticidade', 'transferir_conversa', [draft.title ?? text], 0.9, 'O impacto informado corresponde à interrupção de uma equipe.', 'Fila crítica; agent pausado.') });
      }
      return this.draftMessage(draft, 'Posso preparar esse chamado. Revise os dados e confirme antes de eu enviar ao service desk.');
    }

    if (/rh|recursos humanos|financeiro|reembolso|facilities|limpeza|escritório/.test(lower)) return makeMessage('assistant', 'Consigo ajudar apenas com assuntos de TI. Para esse tema, procure a equipe responsável por RH, Financeiro ou Facilities.', { audit: makeAudit('fora_de_escopo', 'redirecionar', [text], 0.99, 'O pedido não é de suporte de TI.', 'Nenhum chamado aberto.') });
    const db = await readDb(); const tokens = lower.split(/\W+/).filter(t => t.length > 2); const matches = db.articles.map(a => ({ article: a, score: a.tags.filter(tag => tokens.some(token => token.includes(tag) || tag.includes(token))).length + (tokens.some(t => a.title.toLowerCase().includes(t)) ? 2 : 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    if (matches.length) {
      const best = matches[0]!;
      if (/vpn|809|windows 11/.test(lower) && /windows 11/.test(lower)) return makeMessage('assistant', 'O artigo de VPN vale apenas para Windows 10. No Windows 11, o service desk precisa analisar o caso. Quer que eu prepare um chamado?', { quickReplies: ['Abrir chamado', 'Falar com analista'], audit: makeAudit('buscar_ajuda', 'consultar_central_e_perguntar', [best.article.id, best.article.title], 0.94, 'A orientação do artigo não cobre o Windows 11.', 'Aguardando escolha; nenhum chamado criado.') });
      return makeMessage('assistant', `${best.article.content}\n\nFonte: ${best.article.id} · ${best.article.title}`, { audit: makeAudit('tirar_duvida', 'buscar_central_de_ajuda', [best.article.id, best.article.title], Math.min(0.98, 0.76 + best.score * 0.07), 'A resposta veio do artigo mais relacionado na central de ajuda.', 'Dúvida respondida no chat sem abrir chamado.') });
    }
    if (/^(abrir chamado|sim, abrir|criar um chamado)$/i.test(text.trim())) {
      const draft: Draft = { title: 'Solicitação de suporte de TI', description: 'Descrição a completar com o funcionário.', type: 'INC', category: categoryFrom(text), priority: 'Média', affectedPerson: employee.name };
      await mutateDb(db => { const c = db.conversations.find(x => x.id === conversation.id); if (c) c.draft = draft; });
      return makeMessage('assistant', 'Para abrir um chamado, me conte o que parou ou o que você precisa, quem foi afetado e se isso impede o trabalho ou coloca um compromisso de hoje em risco.', { quickReplies: ['Impede meu trabalho', 'Tenho alternativa', 'É um pedido de acesso/equipamento'], audit: makeAudit('abrir_chamado', 'coletar_dados', [], 0.78, 'Preciso de contexto para classificar e evitar chamado incompleto.', 'Aguardando descrição e impacto.') });
    }
    return makeMessage('assistant', 'Entendi. Posso buscar uma orientação, consultar seus chamados ou preparar um novo chamado. O que você prefere?', { quickReplies: ['Consultar meus chamados', 'Abrir chamado', 'Falar com analista'], audit: makeAudit('classificar_mensagem', 'pedir_esclarecimento', [text], 0.52, 'Ainda não há segurança suficiente para escolher uma ação.', 'Nenhuma alteração realizada.') });
  }
  private draftMessage(draft: Draft, opening: string): Message {
    const complete = Boolean(draft.title && draft.description && draft.type && draft.category && draft.priority && draft.affectedPerson);
    const priority = draft.priority ?? 'Média';
    if (priority === 'Crítica') return makeMessage('assistant', 'A equipe parece parada. Vou encaminhar o caso como prioridade crítica para o plantão, conforme a regra de incidentes críticos.', { audit: makeAudit('classificar_criticidade', 'transferir_conversa', [draft.title ?? ''], 0.88, 'Impacto informado sugere interrupção ampla do serviço.', 'Fila crítica; agent pausado.') });
    return makeMessage('assistant', complete ? opening : 'Conte o que aconteceu, quem é afetado e se existe um compromisso em risco hoje.', { draftCard: complete ? { ...draft } : undefined, quickReplies: complete ? undefined : ['Só eu estou afetado', 'Minha equipe está parada', 'Tenho compromisso hoje'], audit: makeAudit('preparar_chamado', 'mostrar_rascunho', [draft.category ?? '', draft.priority ?? '', draft.title ?? ''], 0.84, 'Rascunho para revisão antes de persistir; confirmação explícita obrigatória.', complete ? 'Aguardando confirmação.' : 'Aguardando dados para completar.') });
  }
  private async transfer(id: string): Promise<void> { await mutateDb(db => { const c = db.conversations.find(x => x.id === id); if (c) { c.status = 'waiting_human'; c.assignedAnalyst = undefined; } }); }
}

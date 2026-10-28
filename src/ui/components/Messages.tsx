import { useState, type FormEvent } from 'react';
import { Check, CheckCheck, ChevronDown, ChevronRight, Clock3, Pencil, Ticket as TicketIcon } from 'lucide-react';
import { overdue, shortDate, slaLabel, time, type Audit, type Draft, type Message, type Ticket } from '../api';

const actionLabels: Record<string, string> = {
  mostrar_rascunho: 'classificou a prioridade · montou o rascunho',
  listar_tickets: 'consultou seus chamados', mostrar_ticket: 'consultou o chamado · calculou o prazo',
  consultar_tickets_e_transferir: 'consultou seus chamados · transferiu a conversa',
  criar_ticket: 'criou um chamado', atualizar_ticket: 'atualizou o chamado',
  buscar_central_de_ajuda: 'buscou na central de ajuda', consultar_central_e_perguntar: 'buscou na central de ajuda',
  transferir_conversa: 'encaminhou para um analista', descartar_rascunho: 'cancelou o rascunho',
  coletar_dados: 'identificou a solicitação', solicitar_dados: 'verificou os dados do chamado',
  pedir_esclarecimento: 'avaliou a solicitação', redirecionar: 'verificou o escopo', editar_rascunho: 'atualizou o rascunho',
};

export function Decision({ audit }: { audit: Audit }) {
  return <details className="decision">
    <summary title="Ver detalhes da decisão"><Check size={12} /><span>{actionLabels[audit.action] ?? audit.action.replaceAll('_', ' ')}</span><ChevronDown size={12} /></summary>
    <dl className="decision-details">
      <div><dt>O que entendi</dt><dd>{audit.intent.replaceAll('_', ' ')}</dd></div>
      <div><dt>Segurança da decisão</dt><dd>{Math.round(audit.confidence * 100)}%</dd></div>
      <div><dt>Por quê</dt><dd>{audit.reason}</dd></div>
      {audit.evidence.length > 0 && <div><dt>Evidências</dt><dd>{audit.evidence.join(' · ')}</dd></div>}
      <div><dt>Resultado</dt><dd>{audit.outcome}</dd></div>
    </dl>
  </details>;
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return <article className="ticket-card">
    <div className="card-body">
      <div className="card-eyebrow"><span>Chamado</span><span className="mono">{ticket.id}</span><span className="ticket-status"><i className={`dot ${ticket.status === 'Resolvido' ? 'success' : 'warning'}`} />{ticket.status}</span></div>
      <h3>{ticket.title}</h3><p>{ticket.description}</p>
      <dl className="ticket-fields">
        <div><dt>Categoria</dt><dd>{ticket.category}</dd></div>
        <div><dt>Prioridade</dt><dd><i className={`dot ${ticket.priority === 'Crítica' ? 'danger' : ticket.priority === 'Alta' ? 'warning' : 'blue'}`} />{ticket.priority}</dd></div>
        <div><dt>Aberto em</dt><dd>{shortDate(ticket.createdAt)}, {time(ticket.createdAt)}</dd></div>
        <div><dt>Última atualização</dt><dd>{shortDate(ticket.updatedAt)}{overdue(ticket) && <span className="danger-text"> · prazo vencido</span>}</dd></div>
      </dl>
    </div>
  </article>;
}

export function DraftCard({ draft, id, active, busy, onSend, onEdit }: {
  draft: Draft; id: string; active: boolean; busy: boolean;
  onSend: (content: string) => void; onEdit?: (draft: Draft) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(draft);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (onEdit) {
      try { await onEdit(edited); setEditing(false); }
      catch { /* The workspace displays the API error; keep the form available to retry. */ }
    }
  }
  return <article className="draft-card">
    <div className="card-body">
      <div className="card-eyebrow"><span>{draft.existingTicketId ? 'Atualização de chamado' : 'Novo chamado'}</span><span className="draft-number">Rascunho D-{id.slice(-4).toUpperCase()}</span><span className="draft-status"><i className="dot warning" />{active ? 'Aguardando confirmação' : 'Rascunho apresentado'}</span></div>
      {editing ? <form className="draft-edit" id={`edit-${id}`} onSubmit={event => void save(event)}>
        <label>Título<input value={edited.title ?? ''} onChange={event => setEdited({ ...edited, title: event.target.value })} maxLength={160} required /></label>
        <label>Descrição<textarea value={edited.description ?? ''} onChange={event => setEdited({ ...edited, description: event.target.value })} maxLength={2000} rows={3} required /></label>
        <div className="draft-edit-grid">
          <label>Tipo<select value={edited.type} onChange={event => setEdited({ ...edited, type: event.target.value as Draft['type'] })}><option value="INC">Incidente</option><option value="REQ">Requisição</option></select></label>
          <label>Categoria<select value={edited.category} onChange={event => setEdited({ ...edited, category: event.target.value as Draft['category'] })}>{['Acesso', 'Rede e VPN', 'Hardware', 'Software', 'E-mail', 'Outros'].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label>Quem é afetado<input value={edited.affectedPerson ?? ''} onChange={event => setEdited({ ...edited, affectedPerson: event.target.value })} maxLength={120} required /></label>
        <p className="muted">Prioridade: {draft.priority}. Para alterar o impacto ou a urgência, conte mais no chat.</p>
      </form> : <><h3>{draft.title}</h3><p>{draft.description}</p>
        <dl className="draft-fields"><div><dt>Categoria</dt><dd>{draft.category}</dd></div><div><dt>Prioridade</dt><dd><i className={`dot ${draft.priority === 'Crítica' ? 'danger' : 'warning'}`} />{draft.priority}<small> · {slaLabel(draft.priority)}</small></dd></div><div><dt>Afetados</dt><dd>{draft.affectedPerson}</dd></div></dl>
      </>}
    </div>
    {active && <footer className="card-actions">
      {editing ? <><button className="button primary" type="submit" form={`edit-${id}`} disabled={busy}>Salvar rascunho</button><button className="button ghost" disabled={busy} onClick={() => setEditing(false)}>Voltar</button></> : <>
        <button className="button primary" disabled={busy} onClick={() => onSend('Confirmar e enviar')}>Confirmar<kbd>⌘↵</kbd></button>
        <button className="button secondary" disabled={busy} onClick={() => { setEdited(draft); setEditing(true); }}><Pencil size={13} />Editar</button>
        <button className="button ghost" disabled={busy} onClick={() => onSend('Cancelar')}>Cancelar</button>
      </>}
    </footer>}
  </article>;
}

export function TicketOptions({ options, tickets, disabled, onSend }: { options: string[]; tickets: Ticket[]; disabled: boolean; onSend: (content: string) => void }) {
  return <div className="ticket-options">{options.map(id => {
    const ticket = tickets.find(item => item.id === id);
    return <button key={id} disabled={disabled} onClick={() => onSend(id)}><TicketIcon size={17} /><span><strong className="mono">{id}</strong><span>{ticket?.title ?? 'Consultar chamado'}</span></span><small>{ticket?.status}</small>{ticket && <time>{shortDate(ticket.updatedAt)}</time>}<ChevronRight size={14} /></button>;
  })}</div>;
}

export function MessageView({ message, analyst = false, analystName = 'Rafael Lima', actionable = false, busy = false, tickets = [], pendingDraft, onSend = () => {}, onEditDraft }: {
  message: Message; analyst?: boolean; analystName?: string; actionable?: boolean; busy?: boolean;
  tickets?: Ticket[]; pendingDraft?: Draft; onSend?: (content: string) => void; onEditDraft?: (draft: Draft) => Promise<void>;
}) {
  if (message.role === 'system') return <div className="system-message"><span>{message.content}</span><time>{time(message.createdAt)}</time></div>;
  const isUser = message.role === 'user';
  const draft = message.draftCard ?? (actionable && message.audit?.action === 'mostrar_rascunho' ? pendingDraft : undefined);
  const choices = message.quickReplies ?? [];
  const ticketChoices = choices.length > 0 && choices.every(value => /^(INC|REQ)-/.test(value));
  const content = draft ? message.content.split('\n\n**Rascunho')[0] : message.content;
  return <article className={`message ${message.role} ${analyst ? 'console-message' : ''}`}>
    {!isUser && <div className="message-sender"><strong>{message.role === 'assistant' ? 'Nexo Assist' : analystName}</strong>{analyst && <span className="sender-tag">{message.role === 'assistant' ? 'IA' : 'Suporte'}</span>}{!analyst && message.audit && <Decision audit={message.audit} />}</div>}
    <div className="message-bubble"><div className="message-text">{content}</div>{analyst && <span className="bubble-meta"><time>{time(message.createdAt)}</time>{!isUser && <CheckCheck size={14} />}</span>}</div>
    {analyst && message.audit && <Decision audit={message.audit} />}
    {message.ticketCard && <TicketCard ticket={message.ticketCard} />}
    {draft && <DraftCard draft={actionable ? pendingDraft ?? draft : draft} id={message.id} active={actionable && Boolean(pendingDraft)} busy={busy} onSend={onSend} onEdit={onEditDraft} />}
    {!analyst && !draft && choices.length > 0 && (ticketChoices ? <TicketOptions options={choices} tickets={tickets} disabled={busy || !actionable} onSend={onSend} /> : <div className="quick-replies">{choices.map(choice => <button className="button secondary" disabled={busy || !actionable} key={choice} onClick={() => onSend(choice)}>{choice === 'Falar com analista' && <Clock3 size={14} />}{choice}</button>)}</div>)}
  </article>;
}

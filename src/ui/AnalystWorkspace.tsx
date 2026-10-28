import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, ChevronDown, Headset, LogOut, MessageCircle, PanelRightOpen, RotateCcw, Search, Ticket as TicketIcon, X } from 'lucide-react';
import { api, errorMessage, overdue, time, type AnalystConversation, type Session, type Ticket } from './api';
import { Avatar, ErrorBanner, Logo, Modal } from './components/Common';
import { MessageView, TicketCard } from './components/Messages';

type Filter = 'all' | 'waiting_human' | 'assistant_active' | 'human_active';

export default function AnalystWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [items, setItems] = useState<AnalystConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [messageQuery, setMessageQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => window.matchMedia('(min-width: 1101px)').matches);
  const [mobileChat, setMobileChat] = useState(false);
  const [ticketModal, setTicketModal] = useState<Ticket | 'all' | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const working = useRef(false);
  const selected = items.find(item => item.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    const result = await api<{ conversations: AnalystConversation[] }>('/analyst/conversations?status=all', session.token);
    if (working.current) return;
    setItems(result.conversations);
    setSelectedId(current => result.conversations.some(item => item.id === current) ? current : result.conversations[0]?.id ?? null);
  }, [session.token]);
  useEffect(() => {
    void refresh().catch(cause => setError(errorMessage(cause))).finally(() => setLoading(false));
    const timer = setInterval(() => { if (!working.current && !document.hidden) void refresh().catch(() => {}); }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [selected?.id, selected?.messages.length]);

  async function act(action: 'take' | 'return' | 'close' | 'reply') {
    if (!selected || working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      const result = await api<{ conversation: AnalystConversation }>(`/analyst/conversations/${selected.id}/${action}`, session.token, {
        method: 'POST', body: JSON.stringify({ content: reply }),
      });
      setItems(current => current.map(item => item.id === result.conversation.id ? { ...item, ...result.conversation } : item));
      if (action === 'reply') setReply('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { working.current = false; setBusy(false); }
  }

  const visible = items.filter(item => (filter === 'all' || item.status === filter) && `${item.employee?.name} ${item.employee?.email} ${item.tickets.map(ticket => ticket.id).join(' ')} ${item.messages.at(-1)?.content}`.toLowerCase().includes(query.toLowerCase()));
  const waiting = items.filter(item => item.status === 'waiting_human').length;
  const selectedTickets = selected?.tickets ?? [];
  const mentionedId = selected?.messages.slice().reverse().find(message => message.ticketCard)?.ticketCard?.id;
  const currentTicket = selectedTickets.find(ticket => ticket.id === mentionedId) ?? selectedTickets.find(overdue) ?? selectedTickets[0];
  const isHuman = selected?.status === 'human_active';
  const isWaiting = selected?.status === 'waiting_human';
  const name = selected?.employee?.name ?? 'Funcionário';
  const closedCount = selectedTickets.filter(ticket => ticket.status === 'Resolvido').length;
  const messages = selected?.messages.filter(message => message.content.toLowerCase().includes(messageQuery.toLowerCase())) ?? [];

  return <div className={`analyst-workspace ${detailsOpen ? 'with-details' : ''} ${mobileChat ? 'mobile-chat-open' : ''}`}>
    <aside className="analyst-rail"><Logo markOnly /><button className="rail-button selected" aria-label="Conversas" onClick={() => setMobileChat(false)}><MessageCircle size={19} />{waiting > 0 && <span className="rail-count">{waiting}</span>}</button><div className="rail-account"><Avatar name={session.employee.name} online /><button className="icon-button" onClick={onLogout} aria-label="Sair do console" title="Sair"><LogOut size={18} /></button></div></aside>
    <section className="conversation-list" aria-label="Lista de conversas">
      <header className="list-header"><div className="list-title"><h1>Conversas</h1><span className="available"><i className="dot success" />Disponível</span></div><label className="conversation-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar conversa ou chamado" aria-label="Pesquisar conversa ou chamado" /></label>
        <div className="list-filters" aria-label="Filtrar conversas">{([['all', 'Todas'], ['waiting_human', 'Para você'], ['assistant_active', 'Com o agent'], ['human_active', 'Minhas']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}{value !== 'all' && <span>{items.filter(item => item.status === value).length}</span>}</button>)}</div>
      </header>
      <div className="conversation-list-items">{loading ? <div className="list-empty">Carregando conversas…</div> : visible.length === 0 ? <div className="list-empty"><MessageCircle size={28} /><strong>{query ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa por aqui'}</strong><p>{query ? 'Tente outro nome ou número de chamado.' : 'Os atendimentos aparecerão aqui assim que forem iniciados.'}</p></div> : visible.map(item => <button className={`conversation-list-item ${selectedId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); setMobileChat(true); setReply(''); setMessageQuery(''); setSearchOpen(false); }}>
        <Avatar name={item.employee?.name ?? 'Funcionário'} />
        <span className="conversation-item-body"><span className="conversation-item-top"><strong>{item.employee?.name ?? 'Funcionário'}</strong><time>{time(item.updatedAt)}</time></span><span className="conversation-preview-text">{item.messages.at(-1)?.role === 'assistant' ? 'Nexo: ' : ''}{item.messages.at(-1)?.content}</span><span className={`queue-state ${item.status}`}>{item.status === 'waiting_human' ? <><i className="dot warning" />Transferida{item.tickets[0] ? ` · ${item.tickets[0].id}` : ''}</> : item.status === 'human_active' ? <><i className="dot success" />Você está atendendo</> : item.status === 'closed' ? <><Check size={12} />Atendimento encerrado</> : 'Agent atendendo'}</span></span>
      </button>)}</div>
    </section>
    <section className="console-conversation" aria-label="Histórico do atendimento">
      {!selected ? <div className="console-empty"><Headset size={36} /><h2>Seu próximo atendimento começa aqui.</h2><p>Selecione uma conversa para acompanhar o histórico.</p><ErrorBanner error={error} /></div> : <>
        <header className="console-header"><button className="icon-button mobile-back" aria-label="Voltar para conversas" onClick={() => setMobileChat(false)}><ArrowLeft size={20} /></button><Avatar name={name} /><div className="console-who"><strong>{name}</strong><span>{selected.employee?.department}{currentTicket ? ` · ${currentTicket.id}` : ''}</span></div>
          {isHuman ? <div className="console-header-actions"><button className="button secondary" aria-label="Devolver ao agent" title="Devolver ao agent" disabled={busy} onClick={() => void act('return')}><RotateCcw size={14} /><span>Devolver ao agent</span></button><button className="button danger-button" aria-label="Encerrar atendimento" title="Encerrar atendimento" disabled={busy} onClick={() => void act('close')}><Check size={14} /><span>Encerrar atendimento</span></button></div> : isWaiting ? <span className="waiting-badge"><i className="dot warning" />Aguardando atendente</span> : <span className="queue-state">{selected.status === 'closed' ? 'Encerrada' : 'Agent atendendo'}</span>}
          <button className="icon-button" aria-label="Pesquisar no histórico" title="Pesquisar no histórico" onClick={() => { setSearchOpen(value => !value); setMessageQuery(''); }}><Search size={18} /></button><button className="icon-button" aria-label="Mostrar chamados do funcionário" title="Chamados do funcionário" onClick={() => setDetailsOpen(value => !value)}><PanelRightOpen size={18} /></button>
        </header>
        {searchOpen && <div className="message-search"><Search size={16} /><input autoFocus aria-label="Buscar no histórico" placeholder="Buscar no histórico desta conversa" value={messageQuery} onChange={event => setMessageQuery(event.target.value)} /><button className="icon-button" aria-label="Fechar busca" onClick={() => { setSearchOpen(false); setMessageQuery(''); }}><X size={16} /></button></div>}
        <div className="console-messages"><div className="console-message-stack"><div className="day-divider"><span>Histórico da conversa</span></div>{messages.map(message => <MessageView key={message.id} message={message} analyst analystName={selected.assignedAnalyst ?? session.employee.name} />)}{messageQuery && messages.length === 0 && <p className="empty-search">Nenhuma mensagem encontrada.</p>}<div ref={bottom} /></div></div>
        <footer className="console-footer"><ErrorBanner error={error} onDismiss={() => setError('')} />
          {isWaiting && <div className="takeover-row"><div><strong>{name.split(' ')[0]} espera um atendente</strong><span>Agent pausado</span></div><button className="button secondary" disabled={busy} onClick={() => void act('return')}>Devolver ao agent</button><button className="button primary" disabled={busy} onClick={() => void act('take')}>Assumir atendimento</button></div>}
          <form className={`console-composer ${!isHuman ? 'locked' : ''}`} onSubmit={event => { event.preventDefault(); if (isHuman && reply.trim()) void act('reply'); }}><textarea aria-label="Resposta do analista" placeholder={isWaiting ? 'Assuma o atendimento para responder' : selected.status === 'closed' ? 'Atendimento encerrado' : isHuman ? 'Escreva sua resposta…' : 'O Nexo Assist está atendendo esta conversa'} value={reply} onChange={event => setReply(event.target.value)} disabled={!isHuman || busy} maxLength={2000} rows={1} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && reply.trim()) { event.preventDefault(); void act('reply'); } }} /><button className="console-send" aria-label="Enviar resposta" disabled={!isHuman || !reply.trim() || busy}><ArrowUp size={20} /></button></form>
        </footer>
      </>}
    </section>
    {detailsOpen && <button className="ticket-panel-scrim" aria-label="Fechar painel de chamados" onClick={() => setDetailsOpen(false)} />}
    {detailsOpen && <aside className="ticket-history"><header><div><h2>Chamados de {name.split(' ')[0]}</h2><p>{selectedTickets.length - closedCount} abertos · {closedCount} encerrados</p></div><button className="icon-button" aria-label="Fechar painel de chamados" onClick={() => setDetailsOpen(false)}><X size={18} /></button></header><div className="ticket-history-body">
      <section><h3>Desta conversa</h3>{currentTicket ? <button className="current-ticket" onClick={() => setTicketModal(currentTicket)}><span className="current-ticket-top"><strong className="mono">{currentTicket.id}</strong><span><i className="dot warning" />{isHuman ? 'Em atendimento' : currentTicket.status}</span></span><strong className="current-ticket-title">{currentTicket.title}</strong><span className="current-ticket-meta">{currentTicket.category} · prioridade {currentTicket.priority.toLowerCase()}</span><span className="current-ticket-event"><i className={`dot ${isHuman ? 'success' : 'blue'}`} />{isHuman ? `Assumido por ${selected?.assignedAnalyst ?? session.employee.name}` : isWaiting ? 'Transferido para um analista' : currentTicket.status}<time>{time(selected?.updatedAt ?? currentTicket.updatedAt)}</time></span></button> : <p className="muted">Ainda não há um chamado associado.</p>}</section>
      <section><h3>Outros chamados</h3>{selectedTickets.filter(ticket => ticket.id !== currentTicket?.id).map(ticket => <button className="other-ticket" key={ticket.id} onClick={() => setTicketModal(ticket)}><TicketIcon size={17} /><span><strong>{ticket.title}</strong><small>{ticket.id} · {ticket.status}</small></span><ChevronDown size={13} /></button>)}{selectedTickets.length <= 1 && <p className="muted">Nenhum outro chamado.</p>}</section>
    </div><footer><button className="button secondary" disabled={selectedTickets.length === 0} onClick={() => setTicketModal('all')}>Ver todos os chamados de {name.split(' ')[0]}</button></footer></aside>}
    {ticketModal && <Modal title={ticketModal === 'all' ? `Chamados de ${name}` : ticketModal.id} onClose={() => setTicketModal(null)}>{ticketModal === 'all' ? selectedTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />) : <><TicketCard ticket={ticketModal} /><h3 className="modal-subtitle">Histórico do chamado</h3><ul className="ticket-events">{ticketModal.history.map((event, index) => <li key={index}>{event}</li>)}</ul></>}</Modal>}
  </div>;
}

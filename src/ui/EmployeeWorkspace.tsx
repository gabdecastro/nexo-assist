import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronRight, History, KeyRound, Lock, LogOut, Mail, Menu, MessageCircle, Plus, RotateCcw, UserRound, X } from 'lucide-react';
import { api, errorMessage, shortDate, statusNames, type Conversation, type Draft, type Session, type Ticket } from './api';
import { Avatar, ErrorBanner, Logo, PasswordHelp } from './components/Common';
import { MessageView } from './components/Messages';

function Profile({ session }: { session: Session }) {
  const [reset, setReset] = useState(false);
  return <section className="profile-page"><div className="profile-content">
    <header><h1>Meu perfil</h1><p>Seus dados de acesso ao service desk de TI.</p></header>
    <div className="profile-card"><dl>
      <div><dt>Nome</dt><dd>{session.employee.name}</dd></div>
      <div><dt>E-mail corporativo</dt><dd>{session.employee.email}</dd></div>
    </dl><p className="managed-note"><Lock size={13} />Gerenciado pela TI</p></div>
    <div className="profile-card"><div className="password-row"><span className="password-icon"><KeyRound size={18} /></span><div><strong>Senha</strong><p>Gerenciada pela rede Nexo</p></div><button className="button secondary" onClick={() => setReset(true)}><RotateCcw size={15} />Redefinir senha</button></div><div className="profile-helper"><Mail size={14} /><span>Para recuperar seu acesso, entre em contato com a TI no ramal 4000.</span></div></div>
  </div>{reset && <PasswordHelp onClose={() => setReset(false)} />}</section>;
}

export default function EmployeeWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<'chat' | 'profile'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const selectedId = useRef<string | null>(null);
  const working = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { token, employee } = session;

  const refresh = useCallback(async () => {
    const [cs, ts] = await Promise.all([
      api<{ conversations: Conversation[] }>('/conversations', token), api<{ tickets: Ticket[] }>('/tickets', token),
    ]);
    if (working.current) return;
    setConversations(cs.conversations); setTickets(ts.tickets);
    const next = cs.conversations.find(item => item.id === selectedId.current) ?? cs.conversations[0] ?? null;
    selectedId.current = next?.id ?? null; setCurrent(next);
  }, [token]);

  useEffect(() => {
    let live = true;
    void refresh().catch(cause => { if (live) setError(errorMessage(cause)); }).finally(() => { if (live) setLoading(false); });
    const timer = setInterval(() => { if (!working.current && !document.hidden) void refresh().catch(() => {}); }, 3000);
    return () => { live = false; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [current?.id, current?.messages.length, busy, page]);

  function accept(conversation: Conversation) {
    selectedId.current = conversation.id; setCurrent(conversation);
    setConversations(items => [conversation, ...items.filter(item => item.id !== conversation.id)]);
  }
  async function newConversation() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { const result = await api<{ conversation: Conversation }>('/conversations', token, { method: 'POST' }); accept(result.conversation); setPage('chat'); setHistoryOpen(false); setInput(''); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { working.current = false; setBusy(false); }
  }
  async function send(content: string) {
    if (!content.trim() || working.current || content.length > 2000) return;
    working.current = true; setBusy(true); setError(''); setInput('');
    try {
      const conversation = current ?? (await api<{ conversation: Conversation }>('/conversations', token, { method: 'POST' })).conversation;
      accept(conversation);
      const result = await api<{ conversation: Conversation }>(`/conversations/${conversation.id}/messages`, token, { method: 'POST', body: JSON.stringify({ content: content.trim() }) });
      accept(result.conversation);
      const ts = await api<{ tickets: Ticket[] }>('/tickets', token); setTickets(ts.tickets);
    } catch (cause) { setError(errorMessage(cause)); setInput(content); }
    finally { working.current = false; setBusy(false); }
  }
  async function editDraft(draft: Draft) {
    if (!current || working.current) return;
    working.current = true; setBusy(true); setError('');
    try { const result = await api<{ conversation: Conversation }>(`/conversations/${current.id}/draft`, token, { method: 'PATCH', body: JSON.stringify(draft) }); accept(result.conversation); }
    catch (cause) { setError(errorMessage(cause)); throw cause; }
    finally { working.current = false; setBusy(false); }
  }

  const count = current?.messages.filter(message => message.role === 'user').length ?? 0;
  const closed = current?.status === 'closed';
  const human = current?.status === 'waiting_human' || current?.status === 'human_active';
  const hasDraft = Boolean(current?.draft?.title && current?.draft?.description);
  const latestDraftId = current?.messages.slice().reverse().find(message => message.draftCard || message.audit?.action === 'mostrar_rascunho')?.id;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && hasDraft && current?.status === 'assistant_active' && page === 'chat') { event.preventDefault(); void send('Confirmar e enviar'); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });

  return <div className="employee-workspace">
    {navOpen && <button className="nav-scrim" aria-label="Fechar navegação" onClick={() => setNavOpen(false)} />}
    <aside className={`employee-sidebar ${navOpen ? 'open' : ''}`}>
      <Logo />
      <nav aria-label="Navegação principal"><button className={page === 'chat' ? 'active' : ''} onClick={() => { setPage('chat'); setNavOpen(false); }}><MessageCircle size={16} />Atendimento</button><button className={page === 'profile' ? 'active' : ''} onClick={() => { setPage('profile'); setNavOpen(false); }}><UserRound size={16} />Meu perfil</button></nav>
      <div className="sidebar-account"><div className="employee-user"><Avatar name={employee.name} /><div><strong>{employee.name}</strong><span>{employee.email}</span></div></div><button className="logout-button" onClick={onLogout}><LogOut size={16} />Sair</button></div>
    </aside>
    <main className="employee-main">
      <header className="employee-topbar"><button className="icon-button mobile-nav-button" aria-label="Abrir navegação" onClick={() => setNavOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Service desk de TI</span><ChevronRight size={14} /><strong>{page === 'chat' ? 'Atendimento' : 'Meu perfil'}</strong></div>
        {page === 'chat' && <><span className={`presence ${current?.status ?? 'assistant_active'}`}><i className="dot" />{statusNames[current?.status ?? 'assistant_active']}</span><div className="history-control"><button className="icon-button" aria-label="Histórico de conversas" title="Histórico de conversas" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}><History size={18} /></button>{historyOpen && <div className="history-menu"><header><strong>Suas conversas</strong><button className="icon-button" aria-label="Fechar histórico" onClick={() => setHistoryOpen(false)}><X size={16} /></button></header><button className="history-new" disabled={busy} onClick={() => void newConversation()}><Plus size={16} />Nova conversa</button>{conversations.map(conversation => <button key={conversation.id} className={current?.id === conversation.id ? 'selected' : ''} onClick={() => { selectedId.current = conversation.id; setCurrent(conversation); setHistoryOpen(false); }}><span>{conversation.messages.find(message => message.role === 'user')?.content ?? 'Nova conversa'}</span><small>{shortDate(conversation.updatedAt)} · {statusNames[conversation.status]}</small></button>)}{conversations.length === 0 && <p className="muted">Seu histórico aparecerá aqui.</p>}</div>}</div></>}
      </header>
      {page === 'profile' ? <Profile session={session} /> : <section className="employee-chat" aria-label="Atendimento com Nexo Assist">
        <div className="employee-messages"><div className="message-stack">
          {loading ? <div className="empty-state"><span className="loading-dot" />Carregando seu atendimento…</div> : !current ? <div className="welcome-state"><Logo markOnly /><h1>Como posso ajudar, {employee.name.split(' ')[0]}?</h1><p>Descreva seu problema de TI ou escolha por onde começar.</p><div className="quick-replies"><button className="button secondary" disabled={busy} onClick={() => void send('Consultar meus chamados')}>Consultar meus chamados</button><button className="button secondary" disabled={busy} onClick={() => void send('Abrir chamado')}>Abrir chamado</button></div></div> : current.messages.map((message, index) => <MessageView key={message.id} message={message} analystName={current.assignedAnalyst} actionable={(index === current.messages.length - 1 || (hasDraft && message.id === latestDraftId)) && current.status === 'assistant_active' && count < 30} busy={busy} tickets={tickets} pendingDraft={current.draft} onSend={content => void send(content)} onEditDraft={editDraft} />)}
          {busy && <div className="typing-indicator" role="status"><span /><span /><span /><span className="sr-only">Nexo Assist está respondendo</span></div>}
          <div ref={bottom} />
        </div></div>
        <div className="employee-composer-area"><ErrorBanner error={error} onDismiss={() => setError('')} />
          {human && <p className="handoff-note"><i className="dot warning" />{current?.status === 'waiting_human' ? 'Conversa encaminhada. Você pode acrescentar informações enquanto aguarda.' : `${current?.assignedAnalyst ?? 'Um analista'} está atendendo. O agent está pausado.`}</p>}
          {(closed || count >= 30) ? <div className="session-ended"><p>{closed ? 'Este atendimento foi encerrado.' : 'Você atingiu o limite de 30 mensagens desta sessão.'}</p><button className="button primary" onClick={() => void newConversation()} disabled={busy}><Plus size={16} />Nova conversa</button></div> : <form className="employee-composer" onSubmit={event => { event.preventDefault(); void send(input); }}><textarea ref={textarea} aria-label="Mensagem para o atendimento" placeholder={human ? 'Escreva para o analista…' : 'Escreva para o Nexo…'} rows={1} maxLength={2000} value={input} disabled={loading || busy} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) { event.preventDefault(); void send(input); } }} /><button className="button primary" type="submit" disabled={!input.trim() || busy || loading}><ArrowUp size={14} /><span>Enviar</span></button></form>}
          <div className="session-counter">{count}/30 mensagens nesta sessão</div>
        </div>
      </section>}
    </main>
  </div>;
}

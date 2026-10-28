import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Headset, LockKeyhole, Mail, Phone, Sparkles, Timer, Users } from 'lucide-react';
import { api, errorMessage, type Employee, type Session } from './api';
import { ErrorBanner, Logo, Modal, PasswordHelp } from './components/Common';

export default function Login({ onLogin }: { onLogin: (session: Session, remember: boolean) => void }) {
  const [email, setEmail] = useState('ana.souza@nexo.com.br');
  const [password, setPassword] = useState('nexo2026');
  const [analyst, setAnalyst] = useState(location.pathname === '/analyst');
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'password' | 'privacy' | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (analyst) {
        const result = await api<{ token: string; analyst: { name: string; role: string } }>('/analyst/login', '', {
          method: 'POST', body: JSON.stringify({ password }),
        });
        onLogin({ token: result.token, analyst: true, employee: { id: 'analista-n2', name: result.analyst.name, email: '', department: result.analyst.role } }, remember);
      } else {
        const result = await api<{ token: string; employee: Employee }>('/login', '', {
          method: 'POST', body: JSON.stringify({ email, password }),
        });
        onLogin({ ...result, analyst: false }, remember);
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <main className="login-screen">
    <section className="login-showcase" aria-label="Apresentação do Nexo Assist">
      <Logo />
      <div className="login-story">
        <div className="login-headline">
          <span className="showcase-eyebrow">Service desk de TI da Nexo</span>
          <h1>Seu problema de TI,<br />resolvido em uma conversa.</h1>
          <p>Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.</p>
        </div>
        <div className="preview-wrap" aria-label="Exemplo de atendimento">
          <div className="conversation-preview">
            <div className="preview-user">Meu notebook não conecta na VPN. Erro 809.</div>
            <div className="preview-sender"><strong>Nexo Assist</strong><span>consultou seus chamados · criou um chamado</span></div>
            <div className="preview-agent">Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.</div>
            <div className="preview-ticket"><i className="dot warning" /><strong>INC-20517</strong><span>Rede e VPN · Alta · em até 4 h</span></div>
          </div>
        </div>
      </div>
      <div className="login-stats" title="Indicadores ilustrativos do protótipo">
        <div><strong><Timer size={19} />8 s</strong><span>primeira resposta, em média</span></div>
        <div><strong><Check size={19} />72%</strong><span>resolvidos sem fila</span></div>
        <div><strong><Users size={19} />6</strong><span>analistas online agora</span></div>
      </div>
    </section>
    <section className="login-side">
      <div className="login-help"><span>Problema para entrar?</span><button className="link-button" onClick={() => setModal('password')}>Ligue no ramal 4000</button></div>
      <div className="login-center">
        <form className="login-form" onSubmit={event => void submit(event)}>
          <div className="mobile-brand"><Logo /></div>
          <div className="login-form-heading"><h2>{analyst ? 'Console do analista' : 'Entrar'}</h2><p>{analyst ? 'Entre para acompanhar as conversas do service desk.' : 'Use seu e-mail corporativo e a senha da rede Nexo.'}</p></div>
          <div className="login-fields">
            {!analyst && <label className="form-field"><span>E-mail corporativo</span><div className="input-wrap"><Mail size={16} /><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></div></label>}
            <div className="form-field">
              <div className="field-label"><label htmlFor="login-password">Senha</label><button type="button" className="link-button" onClick={() => setModal('password')}>Esqueci minha senha</button></div>
              <div className="input-wrap"><LockKeyhole size={16} /><input id="login-password" autoComplete="current-password" type={visiblePassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" className="icon-button" aria-label={visiblePassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisiblePassword(value => !value)}>{visiblePassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            </div>
            <label className="remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Manter conectado neste computador</label>
          </div>
          <ErrorBanner error={error} />
          <button type="submit" className="button primary login-submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}<ArrowRight size={16} /></button>
          <div className="login-role"><button type="button" className="link-button" onClick={() => { setAnalyst(value => !value); setError(''); }}>{analyst ? <Sparkles size={15} /> : <Headset size={15} />}{analyst ? 'Entrar como funcionário' : 'Acessar console do analista'}</button></div>
        </form>
      </div>
      <footer className="login-footer"><span>© 2026 Nexo · Service desk de TI</span><button onClick={() => setModal('privacy')}>Privacidade e uso de dados</button></footer>
    </section>
    {modal === 'password' && <PasswordHelp onClose={() => setModal(null)} />}
    {modal === 'privacy' && <Modal title="Privacidade e uso de dados" onClose={() => setModal(null)}><p>Suas conversas e chamados ficam salvos neste ambiente local. O service desk pode acessar o histórico para dar continuidade ao atendimento.</p><p>Se você mantiver a conexão, sua sessão será guardada neste navegador. Use “Sair” ao terminar em um computador compartilhado.</p><p className="support-contact"><Phone size={16} /> Dúvidas? Fale com a TI no ramal 4000.</p></Modal>}
  </main>;
}

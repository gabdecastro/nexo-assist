import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { initials } from '../api';

export function Logo({ markOnly = false }: { markOnly?: boolean }) {
  return <span className="brand" aria-label="Nexo Assist">
    <svg className="brand-mark" width="25" height="24" viewBox="0 0 25 22" fill="currentColor" aria-hidden="true">
      <path d="M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z" />
    </svg>
    {!markOnly && <span>Nexo Assist</span>}
  </span>;
}

export function Avatar({ name, online = false, className = '' }: { name: string; online?: boolean; className?: string }) {
  return <span className={`avatar ${className}`} aria-hidden="true">{initials(name)}{online && <i />}</span>;
}

export function ErrorBanner({ error, onDismiss }: { error: string; onDismiss?: () => void }) {
  if (!error) return null;
  return <div className="error-banner" role="alert"><span>{error}</span>{onDismiss && <button type="button" className="icon-button" onClick={onDismiss} aria-label="Fechar aviso"><X size={16} /></button>}</div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="modal-title">
    <header><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
    <div className="modal-body">{children}</div>
  </dialog>;
}

export function PasswordHelp({ onClose }: { onClose: () => void }) {
  return <Modal title="Redefinir senha" onClose={onClose}>
    <p>Sua senha da rede é gerenciada pela TI. Para recuperar seu acesso, ligue no <strong>ramal 4000</strong>.</p>
    <p className="muted">Neste ambiente de demonstração, qualquer senha permite entrar. Não há envio de e-mail de redefinição.</p>
    <button className="button primary" onClick={onClose}>Entendi</button>
  </Modal>;
}

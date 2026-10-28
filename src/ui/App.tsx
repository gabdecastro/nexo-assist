import { useState } from 'react';
import type { Session } from './api';
import Login from './Login';
import EmployeeWorkspace from './EmployeeWorkspace';
import AnalystWorkspace from './AnalystWorkspace';

function savedSession(): Session | null {
  try {
    const value = localStorage.getItem('nexo-session') ?? sessionStorage.getItem('nexo-session');
    if (!value) return null;
    const parsed = JSON.parse(value) as Session;
    return typeof parsed.token === 'string' && typeof parsed.employee?.name === 'string' ? parsed : null;
  } catch { return null; }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(savedSession);
  function login(next: Session, remember: boolean) {
    localStorage.removeItem('nexo-session'); sessionStorage.removeItem('nexo-session');
    (remember ? localStorage : sessionStorage).setItem('nexo-session', JSON.stringify(next));
    setSession(next);
  }
  function logout() {
    localStorage.removeItem('nexo-session'); sessionStorage.removeItem('nexo-session'); setSession(null);
  }
  if (!session) return <Login onLogin={login} />;
  return session.analyst ? <AnalystWorkspace session={session} onLogout={logout} /> : <EmployeeWorkspace session={session} onLogout={logout} />;
}

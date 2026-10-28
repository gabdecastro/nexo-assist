import type { Conversation, Employee, Ticket } from '../../server/types';
export type { Audit, Conversation, Draft, Employee, Message, Ticket } from '../../server/types';

export interface Session {
  token: string;
  employee: Employee;
  analyst: boolean;
}

export type AnalystConversation = Conversation & { employee?: Employee; tickets: Ticket[] };

export async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir. Tente novamente.');
  return data;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível conectar ao service desk.';
export const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
export const overdue = (ticket: Ticket) => ticket.status !== 'Resolvido' && Date.parse(ticket.dueAt) < Date.now();
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
export const statusNames: Record<Conversation['status'], string> = {
  assistant_active: 'Assistente online', waiting_human: 'Aguardando atendente',
  human_active: 'Analista atendendo', closed: 'Atendimento encerrado',
};
export const slaLabel = (priority?: string) => ({ 'Crítica': '1 hora', 'Alta': '4 horas úteis', 'Média': '3 dias úteis', 'Baixa': '5 dias úteis' })[priority ?? ''] ?? 'a definir';

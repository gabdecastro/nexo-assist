import { mutateDb, readDb, timestamp } from './store.js';
import { deadline } from './sla.js';
import type { Draft, Ticket, Priority, TicketType, Category } from './types.js';

export function classifyTicket(text: string): { type: TicketType; category: Category; priority: Priority } {
  const s = text.toLocaleLowerCase('pt-BR');
  const type: TicketType = /solicit|preciso de|quero um|pedir|acesso|equipamento|licença/.test(s) && !/parou|erro|não funciona|falha/.test(s) ? 'REQ' : 'INC';
  const category: Category = /vpn|wi-?fi|rede|internet/.test(s) ? 'Rede e VPN' : /senha|acesso|login|sap/.test(s) ? 'Acesso' : /notebook|computador|monitor|teclado/.test(s) ? 'Hardware' : /email|e-mail|outlook/.test(s) ? 'E-mail' : /software|aplicativo|licença|figma/.test(s) ? 'Software' : 'Outros';
  const priority: Priority = /empresa toda|equipe inteira|equipe toda|todos pararam|sistema fora para todos/.test(s) ? 'Crítica' : /não consigo trabalhar|impede.*trabalhar|reunião hoje|compromisso hoje/.test(s) ? 'Alta' : /alternativa|contorno|lento|atrapalha/.test(s) ? 'Média' : 'Baixa';
  return { type, category, priority };
}
export class TicketService {
  async listFor(ownerId: string): Promise<Ticket[]> { const db = await readDb(); return db.tickets.filter(t => t.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async createOrUpdate(ownerId: string, draft: Draft & { title: string; description: string; type: TicketType; category: Category; priority: Priority; affectedPerson: string }): Promise<{ ticket: Ticket; updated: boolean }> {
    return mutateDb(db => {
      const now = timestamp();
      const existing = draft.existingTicketId ? db.tickets.find(t => t.id === draft.existingTicketId && t.ownerId === ownerId) : db.tickets.find(t => t.ownerId === ownerId && t.status !== 'Resolvido' && `${t.title} ${t.description}`.toLocaleLowerCase('pt-BR').split(/\W+/).filter(w => w.length > 4).some(w => `${draft.title} ${draft.description}`.toLocaleLowerCase('pt-BR').includes(w)));
      if (existing) {
        existing.description = `${existing.description}\n\nAtualização do funcionário: ${draft.description}`;
        existing.updatedAt = now; existing.priority = draft.priority; existing.status = 'Aberto';
        existing.dueAt = deadline(draft.priority, new Date(now));
        existing.history.push(`Atualizado em ${new Date(now).toLocaleString('pt-BR')}`);
        return { ticket: existing, updated: true };
      }
      const resolved = db.tickets.find(t => t.ownerId === ownerId && t.status === 'Resolvido' && Date.now() - Date.parse(t.updatedAt) <= 7 * 86400000 && `${t.title} ${t.description}`.toLocaleLowerCase('pt-BR').split(/\W+/).filter(w => w.length > 4).some(w => `${draft.title} ${draft.description}`.toLocaleLowerCase('pt-BR').includes(w)));
      const n = String(Date.now()).slice(-5); const id = `${draft.type}-${n}`;
      const ticket: Ticket = { id, ownerId, affectedPerson: draft.affectedPerson, title: draft.title, description: draft.description, type: draft.type, category: draft.category, priority: draft.priority, status: 'Aberto', createdAt: now, updatedAt: now, dueAt: deadline(draft.priority, new Date(now)), history: [resolved ? `Reaberto dentro de 7 dias (${resolved.id})` : 'Chamado criado após confirmação do funcionário'] };
      if (resolved) { resolved.status = 'Resolvido'; ticket.id = resolved.id; ticket.createdAt = resolved.createdAt; db.tickets = db.tickets.filter(t => t !== resolved); }
      db.tickets.push(ticket); return { ticket, updated: Boolean(resolved) };
    });
  }
}

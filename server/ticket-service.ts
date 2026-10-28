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
type CompleteDraft = Required<Omit<Draft, 'existingTicketId'>> & Pick<Draft, 'existingTicketId'>;
const words = (text: string) => new Set(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2 && !['para', 'com', 'uma', 'meu', 'minha', 'preciso', 'chamado', 'abrir', 'problema', 'solicito'].includes(w)) ?? []);
export function sameProblem(ticket: Ticket, draft: CompleteDraft): boolean {
  if (ticket.type !== draft.type || ticket.category !== draft.category) return false;
  const a = words(ticket.title); const b = words(draft.title);
  const common = [...a].filter(word => b.has(word)).length;
  return common >= 2 && common / Math.max(a.size, b.size) >= 0.6;
}

export class TicketService {
  // Opt-in outage simulation; retries happen before any write, never after an uncertain write.
  private unavailableUntil = Date.now() + Math.max(0, Number(process.env.LEGACY_OUTAGE_MS) || 0);
  private async available(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() >= this.unavailableUntil) return;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    }
    throw new Error('Serviço de chamados temporariamente indisponível. Seu rascunho está salvo; tente novamente em alguns segundos.');
  }
  async listFor(ownerId: string): Promise<Ticket[]> {
    await this.available();
    return (await readDb()).tickets.filter(t => t.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async createOrUpdate(ownerId: string, draft: CompleteDraft): Promise<{ ticket: Ticket; updated: boolean }> {
    await this.available();
    return mutateDb(db => {
      const now = timestamp();
      const own = db.tickets.filter(t => t.ownerId === ownerId);
      const recent = (t: Ticket) => Date.parse(now) - Date.parse(t.updatedAt) <= 7 * 86_400_000;
      const explicit = draft.existingTicketId ? own.find(t => t.id === draft.existingTicketId) : undefined;
      if (draft.existingTicketId && (!explicit || (explicit.status === 'Resolvido' && !recent(explicit)))) {
        throw new Error('Chamado indisponível para atualização ou fora do prazo de reabertura.');
      }
      const existing = explicit ?? own.find(t => t.status !== 'Resolvido' && sameProblem(t, draft))
        ?? own.find(t => t.status === 'Resolvido' && recent(t) && sameProblem(t, draft));
      if (existing) {
        const reopening = existing.status === 'Resolvido';
        existing.description += `\n\nAtualização do funcionário: ${draft.description}`;
        existing.updatedAt = now; existing.priority = draft.priority; existing.status = 'Aberto';
        existing.affectedPerson = draft.affectedPerson;
        existing.dueAt = deadline(draft.priority, new Date(now));
        existing.history.push(`${reopening ? 'Reaberto dentro de 7 dias' : 'Atualizado'} em ${now}`);
        return { ticket: existing, updated: true };
      }
      // Allocated inside the same atomic mutation as insertion.
      const sequence = Math.max(20000, ...db.tickets.map(t => Number(t.id.split('-')[1]) || 0)) + 1;
      const ticket: Ticket = { id: `${draft.type}-${sequence}`, ownerId, affectedPerson: draft.affectedPerson, title: draft.title, description: draft.description, type: draft.type, category: draft.category, priority: draft.priority, status: 'Aberto', createdAt: now, updatedAt: now, dueAt: deadline(draft.priority, new Date(now)), history: ['Chamado criado após confirmação do funcionário'] };
      db.tickets.push(ticket); return { ticket, updated: false };
    });
  }
}

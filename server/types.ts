export type TicketType = 'INC' | 'REQ';
export type Category = 'Acesso' | 'Rede e VPN' | 'Hardware' | 'Software' | 'E-mail' | 'Outros';
export type Priority = 'Crítica' | 'Alta' | 'Média' | 'Baixa';
export type TicketStatus = 'Aberto' | 'Aguardando analista' | 'Resolvido' | 'Aprovado';
export type ConversationStatus = 'assistant_active' | 'waiting_human' | 'human_active' | 'closed';
export interface Employee { id: string; name: string; email: string; department: string }
export interface HelpArticle { id: string; title: string; content: string; tags: string[] }
export interface Audit { intent: string; action: string; evidence: string[]; confidence: number; reason: string; outcome: string }
export interface Ticket { id: string; ownerId: string; affectedPerson: string; title: string; description: string; type: TicketType; category: Category; priority: Priority; status: TicketStatus; createdAt: string; updatedAt: string; dueAt: string; history: string[] }
export interface Draft { title?: string; description?: string; type?: TicketType; category?: Category; priority?: Priority; affectedPerson?: string; existingTicketId?: string }
export interface Message { id: string; role: 'user' | 'assistant' | 'analyst' | 'system'; content: string; createdAt: string; quickReplies?: string[]; ticketCard?: Ticket; draftCard?: Draft; audit?: Audit }
export interface Conversation { id: string; ownerId: string; status: ConversationStatus; messages: Message[]; draft?: Draft; assignedAnalyst?: string; createdAt: string; updatedAt: string }
export interface Database { employees: Employee[]; articles: HelpArticle[]; tickets: Ticket[]; conversations: Conversation[] }

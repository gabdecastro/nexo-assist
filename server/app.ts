import 'dotenv/config';
import { resolve } from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AgentService } from './agent.js';
import { mutateDb, newId, readDb, timestamp } from './store.js';
import type { Category, Conversation, Draft, TicketType } from './types.js';

const app = express(); const agent = new AgentService();
app.use(express.json({ limit: '32kb' }));
const secret = process.env.SESSION_SECRET || 'nexo-demo-only-change-before-deploy';
if (process.env.VERCEL && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || !process.env.ANALYST_PASSWORD || process.env.ANALYST_PASSWORD.length < 16)) throw new Error('Configure SESSION_SECRET (32+ caracteres) e ANALYST_PASSWORD (16+ caracteres) para o deploy.');
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
type Session = { sub: string; role: 'employee' | 'analyst'; exp: number };
const tokenFor = (session: Omit<Session, 'exp'>) => { const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + 86_400_000 })).toString('base64url'); const sig = createHmac('sha256', secret).update(payload).digest('base64url'); return `${payload}.${sig}`; };
function sessionFrom(req: Request): Session | null {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, ''); if (!token) return null;
  const [payload, signature, extra] = token.split('.'); if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest(); let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try { const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session; return typeof value.sub === 'string' && ['employee', 'analyst'].includes(value.role) && typeof value.exp === 'number' && value.exp > Date.now() ? value : null; } catch { return null; }
}
function requireRole(role: Session['role']) { return (req: Request, res: Response, next: NextFunction) => { const session = sessionFrom(req); if (!session || session.role !== role) { res.status(401).json({ error: 'Sessão inválida ou sem permissão.' }); return; } res.locals.session = session; next(); }; }
const employeeOnly = requireRole('employee'); const analystOnly = requireRole('analyst');
const asError = (error: unknown) => error instanceof Error ? error.message : 'Erro interno no serviço de chamados.';

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase(); const password = String(req.body?.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 256) { res.status(400).json({ error: 'Informe e-mail corporativo e senha.' }); return; }
  const canonicalEmail = (value: string) => value.toLowerCase().replace(/@nexo\.com\.br$/, '@nexo.com');
  const db = await readDb(); let employee = db.employees.find(e => canonicalEmail(e.email) === canonicalEmail(email));
  if (!employee && (process.env.ALLOW_DEMO_SIGNUP === 'false' || process.env.VERCEL)) { res.status(401).json({ error: 'Use um dos funcionários de demonstração.' }); return; }
  if (!employee) { employee = { id: `demo-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`, name: email.split('@')[0]!.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email, department: 'Demonstração' }; await mutateDb(s => { if (!s.employees.some(e => e.id === employee!.id)) s.employees.push(employee!); }); }
  res.json({ token: tokenFor({ sub: employee.id, role: 'employee' }), employee });
});
app.post('/api/analyst/login', (req, res) => { if (!req.body?.password) { res.status(400).json({ error: 'Informe uma senha de demonstração.' }); return; } if (process.env.ANALYST_PASSWORD && String(req.body.password) !== process.env.ANALYST_PASSWORD) { res.status(401).json({ error: 'Credenciais de analista inválidas.' }); return; } res.json({ token: tokenFor({ sub: 'analista-n2', role: 'analyst' }), analyst: { name: 'Rafael Lima', role: 'Suporte N2' } }); });
app.get('/api/me', employeeOnly, async (_req, res) => { const s = res.locals.session as Session; const db = await readDb(); res.json({ employee: db.employees.find(e => e.id === s.sub) }); });
app.get('/api/articles', employeeOnly, async (_req, res) => res.json({ articles: (await readDb()).articles }));
app.get('/api/tickets', employeeOnly, async (_req, res) => { const s = res.locals.session as Session; const db = await readDb(); res.json({ tickets: db.tickets.filter(t => t.ownerId === s.sub) }); });
app.get('/api/conversations', employeeOnly, async (_req, res) => { const s = res.locals.session as Session; const db = await readDb(); res.json({ conversations: db.conversations.filter(c => c.ownerId === s.sub).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }); });
app.post('/api/conversations', employeeOnly, async (_req, res) => {
  const s = res.locals.session as Session; const db = await readDb(); const employee = db.employees.find(e => e.id === s.sub);
  if (!employee) { res.status(401).json({ error: 'Funcionário não encontrado.' }); return; }
  const conversation: Conversation = { id: newId('conv'), ownerId: s.sub, status: 'assistant_active', messages: [{ id: newId('msg'), role: 'assistant', content: `Olá, ${employee.name.split(' ')[0]}! Sou o Nexo Assist. Como posso ajudar com sua TI hoje?`, createdAt: timestamp(), quickReplies: ['Consultar meus chamados', 'Tirar uma dúvida', 'Abrir chamado'] }], createdAt: timestamp(), updatedAt: timestamp() };
  await mutateDb(state => {
    if (state.conversations.filter(c => c.ownerId === s.sub && Date.parse(c.createdAt) > Date.now() - 86_400_000).length >= 10) throw new Error('Limite de 10 conversas por funcionário em 24 horas.');
    state.conversations.push(conversation);
  }); res.status(201).json({ conversation });
});
app.post('/api/conversations/:id/messages', employeeOnly, async (req, res) => {
  const s = res.locals.session as Session; const content = String(req.body?.content ?? '').trim();
  if (!content || content.length > 2000) { res.status(400).json({ error: 'Escreva uma mensagem de até 2.000 caracteres.' }); return; }
  try { res.json({ conversation: await agent.respond(String(req.params.id), s.sub, content) }); }
  catch (error) { res.status(409).json({ error: asError(error) }); }
});
app.patch('/api/conversations/:id/draft', employeeOnly, async (req, res) => {
  const session = res.locals.session as Session;
  const { title, description, affectedPerson, type, category } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim() || title.length > 160 ||
      typeof description !== 'string' || !description.trim() || description.length > 2000 ||
      typeof affectedPerson !== 'string' || !affectedPerson.trim() || affectedPerson.length > 120 ||
      !['INC', 'REQ'].includes(String(type)) ||
      !['Acesso', 'Rede e VPN', 'Hardware', 'Software', 'E-mail', 'Outros'].includes(String(category))) {
    res.status(400).json({ error: 'Preencha título, descrição, tipo, categoria e pessoa afetada com valores válidos.' }); return;
  }
  try {
    const conversation = await mutateDb(db => {
      const current = db.conversations.find(item => item.id === String(req.params.id) && item.ownerId === session.sub);
      if (!current || current.status !== 'assistant_active' || !current.draft || (current.processingUntil ?? 0) > Date.now()) throw new Error('Este rascunho não está disponível para edição.');
      const draft: Draft = { ...current.draft, title: title.trim(), description: description.trim(), affectedPerson: affectedPerson.trim(), type: type as TicketType, category: category as Category };
      current.draft = draft;
      current.updatedAt = timestamp();
      current.messages.push({ id: newId('msg'), role: 'assistant', content: 'Atualizei o rascunho. Confira os dados antes de confirmar.', createdAt: timestamp(), draftCard: { ...draft }, audit: { intent: 'editar_chamado', action: 'editar_rascunho', evidence: [draft.title ?? ''], confidence: 1, reason: 'Alterações informadas pelo funcionário no formulário de revisão.', outcome: 'Rascunho salvo; nenhum chamado foi alterado.' } });
      return current;
    });
    res.json({ conversation });
  } catch (error) { res.status(409).json({ error: asError(error) }); }
});
app.get('/api/analyst/conversations', analystOnly, async (req, res) => {
  const status = String(req.query.status ?? 'all'); const db = await readDb();
  const conversations = db.conversations.filter(c => status === 'all' || c.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const result = conversations.map(c => ({ ...c, employee: db.employees.find(e => e.id === c.ownerId), tickets: db.tickets.filter(t => t.ownerId === c.ownerId) })); res.json({ conversations: result });
});
app.post('/api/analyst/conversations/:id/:action', analystOnly, async (req, res) => {
  const action = String(req.params.action); if (!['take', 'return', 'close', 'reply'].includes(action)) { res.status(404).json({ error: 'Ação não encontrada.' }); return; }
  try {
    const conversation = await mutateDb(db => {
      const c = db.conversations.find(x => x.id === String(req.params.id)); if (!c) throw new Error('Conversa não encontrada.');
      if ((c.processingUntil ?? 0) > Date.now() && action !== 'reply') throw new Error('Aguarde o processamento da mensagem em andamento.');
      if (action === 'take') { if (c.status !== 'waiting_human') throw new Error('Esta conversa não está aguardando atendente.'); c.status = 'human_active'; c.assignedAnalyst = 'Rafael Lima'; c.messages.push({ id: newId('msg'), role: 'system', content: 'Rafael Lima assumiu · agent pausado', createdAt: timestamp() }); }
      if (action === 'return') { if (c.status !== 'human_active' && c.status !== 'waiting_human') throw new Error('Esta conversa já não está com o atendimento humano.'); c.status = 'assistant_active'; c.assignedAnalyst = undefined; c.messages.push({ id: newId('msg'), role: 'system', content: 'Conversa devolvida ao Nexo Assist', createdAt: timestamp() }); }
      if (action === 'close') { if (c.status !== 'human_active') throw new Error('Assuma o atendimento antes de encerrá-lo.'); c.status = 'closed'; c.assignedAnalyst = 'Rafael Lima'; c.messages.push({ id: newId('msg'), role: 'system', content: 'Atendimento encerrado por Rafael Lima', createdAt: timestamp() }); }
      if (action === 'reply') { if (c.status !== 'human_active') throw new Error('Assuma a conversa antes de responder.'); const content = String(req.body?.content ?? '').trim(); if (!content || content.length > 2000) throw new Error('Escreva uma resposta de até 2.000 caracteres.'); c.messages.push({ id: newId('msg'), role: 'analyst', content, createdAt: timestamp() }); }
      c.updatedAt = timestamp(); return c;
    }); res.json({ conversation });
  } catch (error) { res.status(409).json({ error: asError(error) }); }
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Rota não encontrada.' }); });
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => { res.sendFile(resolve('dist/index.html')); });
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (error as { status?: number })?.status;
  res.status(status === 400 || status === 413 ? status : 500).json({ error: status === 400 ? 'JSON inválido.' : status === 413 ? 'Requisição muito grande.' : 'Não foi possível concluir a operação. Tente novamente.' });
});
export default app;

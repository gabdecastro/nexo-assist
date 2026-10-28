import { createNeonStore } from './neon-store.js';
import { mutateSnapshot } from './snapshot-store.js';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Database, Employee, HelpArticle, Ticket } from './types.js';

const dataPath = resolve(process.env.DATA_FILE ?? './data/db.json');
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
const due = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();

const employees: Employee[] = [
  { id: 'emp-ana', name: 'Ana Souza', email: 'ana.souza@nexo.com', department: 'Produto' },
  { id: 'emp-marcos', name: 'Marcos Lima', email: 'marcos.lima@nexo.com', department: 'Financeiro' },
  { id: 'emp-julia', name: 'Júlia Costa', email: 'julia.costa@nexo.com', department: 'Design' },
  { id: 'emp-paulo', name: 'Paulo Mendes', email: 'paulo.mendes@nexo.com', department: 'Engenharia' }
];
const articles: HelpArticle[] = [
  { id: 'KB-001', title: 'VPN com erro 809', content: 'No Windows 10, reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. No Windows 11, abra um chamado para o suporte.', tags: ['vpn', 'rede', '809'] },
  { id: 'KB-002', title: 'Horário do service desk', content: 'Atendimento de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.', tags: ['horário', 'atendimento', 'plantão'] },
  { id: 'KB-003', title: 'Redefinir senha corporativa', content: 'Acesse o portal de identidade, escolha “Esqueci minha senha” e confirme pelo aplicativo autenticador.', tags: ['senha', 'acesso', 'login'] },
  { id: 'KB-004', title: 'Configurar e-mail no celular', content: 'Instale o Microsoft Outlook pela loja corporativa e entre com seu e-mail Nexo. Não configure a conta em apps de terceiros.', tags: ['email', 'e-mail', 'celular'] },
  { id: 'KB-005', title: 'Solicitar acesso a sistemas', content: 'Informe o nome do sistema e o motivo do acesso. A aprovação é encaminhada à liderança responsável.', tags: ['acesso', 'permissão', 'sistema'] },
  { id: 'KB-006', title: 'Notebook lento', content: 'Reinicie o computador, feche aplicações que não estiver usando e aguarde a conclusão de atualizações pendentes.', tags: ['notebook', 'lento', 'hardware'] },
  { id: 'KB-007', title: 'Conectar à rede Wi-Fi corporativa', content: 'Selecione Nexo-Corp e entre com seu e-mail corporativo. Se a rede não aparecer, conecte-se à VPN e abra um chamado.', tags: ['wifi', 'wi-fi', 'rede'] }
];
const tickets: Ticket[] = [
  { id: 'INC-20311', ownerId: 'emp-ana', affectedPerson: 'Ana Souza', title: 'Notebook lento após atualização do Windows', description: 'Notebook lento após atualização do Windows.', type: 'INC', category: 'Hardware', priority: 'Média', status: 'Aguardando analista', createdAt: ago(6), updatedAt: ago(6), dueAt: ago(1), history: ['Chamado criado há 6 dias', 'Prazo de resposta excedido'] },
  { id: 'REQ-10442', ownerId: 'emp-ana', affectedPerson: 'Ana Souza', title: 'Segundo monitor para home office', description: 'Solicitação de monitor adicional.', type: 'REQ', category: 'Hardware', priority: 'Baixa', status: 'Aprovado', createdAt: ago(8), updatedAt: ago(7), dueAt: due(120), history: ['Chamado aprovado'] },
  { id: 'INC-20150', ownerId: 'emp-ana', affectedPerson: 'Ana Souza', title: 'Senha do SAP bloqueada', description: 'Conta bloqueada após tentativas de login.', type: 'INC', category: 'Acesso', priority: 'Média', status: 'Resolvido', createdAt: ago(12), updatedAt: ago(4), dueAt: ago(9), history: ['Chamado resolvido há 4 dias'] },
  { id: 'INC-20914', ownerId: 'emp-marcos', affectedPerson: 'Marcos Lima', title: 'VPN não conecta em casa', description: 'Erro 809 ao conectar à VPN.', type: 'INC', category: 'Rede e VPN', priority: 'Alta', status: 'Aberto', createdAt: ago(1), updatedAt: ago(1), dueAt: due(3), history: ['Chamado criado'] },
  { id: 'REQ-10520', ownerId: 'emp-julia', affectedPerson: 'Júlia Costa', title: 'Licença do Figma', description: 'Solicitação de acesso ao Figma.', type: 'REQ', category: 'Software', priority: 'Baixa', status: 'Aberto', createdAt: ago(2), updatedAt: ago(2), dueAt: due(96), history: ['Chamado criado'] },
  { id: 'INC-20702', ownerId: 'emp-paulo', affectedPerson: 'Paulo Mendes', title: 'E-mail não sincroniza', description: 'Caixa de entrada não atualiza.', type: 'INC', category: 'E-mail', priority: 'Média', status: 'Aberto', createdAt: ago(3), updatedAt: ago(2), dueAt: due(18), history: ['Chamado criado'] }
];

const seed = (): Database => structuredClone({ employees, articles, tickets, conversations: [] });
const remote = process.env.DATABASE_URL ? createNeonStore(process.env.DATABASE_URL, seed) : undefined;
if (process.env.VERCEL && !remote) throw new Error('DATABASE_URL é obrigatório na Vercel; arquivo local não é persistente.');

async function ensureFile(): Promise<void> {
  try { await readFile(dataPath, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(dirname(dataPath), { recursive: true });
    const initial = seed();
    try { await writeFile(dataPath, JSON.stringify(initial, null, 2), { encoding: 'utf8', flag: 'wx' }); }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause; }
  }
}
export async function readDb(): Promise<Database> { if (remote) return (await remote.read()).data; await ensureFile(); return JSON.parse(await readFile(dataPath, 'utf8')) as Database; }
async function writeDb(db: Database): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true });
  const tmp = `${dataPath}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, dataPath);
}
// Serialize local mutations so employee and analyst updates cannot overwrite each other.
let mutationQueue: Promise<void> = Promise.resolve();
export function mutateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const operation = mutationQueue.then(async () => {
    if (remote) return mutateSnapshot(remote, fn);
    const db = await readDb(); const result = await fn(db); await writeDb(db); return result;
  });
  mutationQueue = operation.then(() => {}, () => {});
  return operation;
}
export function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
export function timestamp(): string { return new Date().toISOString(); }

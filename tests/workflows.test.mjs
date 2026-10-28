import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

let server;
let directory;
let base;

async function start() {
  server = spawn(process.execPath, ['dist-server/index.js'], {
    env: { ...process.env, PORT: '0', GEMINI_API_KEY: '', DATABASE_URL: '', VERCEL: '', LEGACY_OUTAGE_MS: '0', ANALYST_PASSWORD: '', ALLOW_DEMO_SIGNUP: 'true', DATA_FILE: join(directory, 'db.json'), SESSION_SECRET: 'integration-test-only' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('API did not start')), 10000);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`API exited: ${code}`)); });
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/http:\/\/localhost:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
  });
}
async function stop() {
  if (server && server.exitCode === null) { const exit = once(server, 'exit'); server.kill(); await exit; }
}
before(async () => { directory = await mkdtemp(join(tmpdir(), 'nexo-workflows-')); await start(); });
after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });

async function request(path, token = '', body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, ...await response.json() };
}
async function login(email = 'ana.souza@nexo.com.br') {
  const result = await request('/login', '', { email, password: 'demo' });
  assert.equal(result.status, 200); return result;
}
async function conversation(token) { return (await request('/conversations', token, {})).conversation; }
async function send(id, token, content) { return request(`/conversations/${id}/messages`, token, { content }); }

test('prototype login aliases resolve to the same employee and private tickets', async () => {
  const a = await login(); const b = await login('ana.souza@nexo.com'); const other = await login('marcos.lima@nexo.com');
  assert.equal(a.employee.id, b.employee.id);
  const ownTickets = (await request('/tickets', a.token)).tickets;
  assert.ok(ownTickets.length > 0);
  assert.ok(ownTickets.every(ticket => ticket.ownerId === a.employee.id));
  assert.ok((await request('/tickets', other.token)).tickets.every(ticket => ticket.ownerId !== a.employee.id));
});

test('ticket selection precedes handoff and includes the overdue status', async () => {
  const { token } = await login(); const c = await conversation(token);
  const result = await send(c.id, token, 'Qual o status do meu chamado?');
  assert.equal(result.conversation.status, 'assistant_active');
  assert.ok(result.conversation.messages.at(-1).quickReplies.includes('INC-20311'));
  const detail = await send(c.id, token, 'INC-20311');
  assert.equal(detail.conversation.messages.at(-1).ticketCard.id, 'INC-20311');
  assert.match(detail.conversation.messages.at(-1).content, /vencido/);
  assert.ok(detail.conversation.messages.at(-1).audit);
});

test('editing a draft is private and does not write a ticket until confirmation', async () => {
  const { token } = await login('draft-review@nexo.com');
  const other = await login('other-review@nexo.com');
  const c = await conversation(token);
  const prepared = await send(c.id, token, 'Preciso de um monitor para trabalho, sem urgência.');
  assert.ok(prepared.conversation.messages.at(-1).draftCard);
  assert.equal((await request('/tickets', token)).tickets.length, 0);
  const draft = { ...prepared.conversation.draft, title: 'Monitor externo para edição', description: 'Solicito monitor externo de 24 polegadas.' };
  assert.equal((await request(`/conversations/${c.id}/draft`, other.token, draft, 'PATCH')).status, 409);
  assert.equal((await request(`/conversations/${c.id}/draft`, token, { ...draft, title: '' }, 'PATCH')).status, 400);
  const edited = await request(`/conversations/${c.id}/draft`, token, draft, 'PATCH');
  assert.equal(edited.status, 200);
  assert.equal(edited.conversation.messages.at(-1).draftCard.title, draft.title);
  assert.equal((await request('/tickets', token)).tickets.length, 0);
  const confirmed = await send(c.id, token, 'Confirmar e enviar');
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.conversation.messages.at(-1).ticketCard.title, draft.title);
  assert.equal(confirmed.conversation.draft, undefined);
  assert.equal((await request('/tickets', token)).tickets.length, 1);
  assert.equal((await request(`/conversations/${c.id}/draft`, token, draft, 'PATCH')).status, 409);
});

test('human handoff supports two-way messages, return, close and restart', async () => {
  const employee = await login('handoff-review@nexo.com');
  const analyst = await request('/analyst/login', '', { password: 'demo' });
  const c = await conversation(employee.token);
  await send(c.id, employee.token, 'Abrir chamado');
  const handed = await send(c.id, employee.token, 'Falar com um analista');
  assert.equal(handed.conversation.status, 'waiting_human');
  const waitingMessage = await send(c.id, employee.token, 'Meu computador está ligado.');
  assert.equal(waitingMessage.conversation.messages.at(-1).role, 'user');
  const take = await request(`/analyst/conversations/${c.id}/take`, analyst.token, {});
  assert.equal(take.conversation.status, 'human_active');
  assert.equal(take.conversation.messages.at(-1).role, 'system');
  await Promise.all([
    send(c.id, employee.token, 'Pode iniciar o atendimento.'),
    request(`/analyst/conversations/${c.id}/reply`, analyst.token, { content: 'Vou verificar seu computador.' }),
  ]);
  const saved = (await request('/conversations', employee.token)).conversations.find(item => item.id === c.id);
  assert.ok(saved.messages.some(message => message.content === 'Pode iniciar o atendimento.'));
  assert.ok(saved.messages.some(message => message.role === 'analyst' && message.content === 'Vou verificar seu computador.'));
  const returned = await request(`/analyst/conversations/${c.id}/return`, analyst.token, {});
  assert.equal(returned.conversation.status, 'assistant_active');
  await send(c.id, employee.token, 'Falar com analista');
  await request(`/analyst/conversations/${c.id}/take`, analyst.token, {});
  const closed = await request(`/analyst/conversations/${c.id}/close`, analyst.token, {});
  assert.equal(closed.conversation.status, 'closed');
  assert.equal((await send(c.id, employee.token, 'Mensagem depois de encerrar')).status, 409);
  await stop(); await start();
  const restored = (await request('/conversations', employee.token)).conversations.find(item => item.id === c.id);
  assert.equal(restored.status, 'closed');
  assert.equal(restored.messages.length, closed.conversation.messages.length);
});


test('out-of-scope requests never become tickets and unknown cases carry a handoff summary', async () => {
  const { token } = await login('scope-review@nexo.com');
  const c = await conversation(token);
  const outside = await send(c.id, token, 'Preciso de ajuda com reembolso de viagem');
  assert.equal(outside.conversation.draft, undefined);
  assert.equal(outside.conversation.messages.at(-1).audit.action, 'redirecionar');
  const unsure = await send(c.id, token, 'O fluxo xyz retorna valor inesperado QJZ');
  assert.equal(unsure.conversation.status, 'waiting_human');
  assert.match(unsure.conversation.handoffSummary, /QJZ/);
});

test('impact is required before confirmation and critical cases go to the human queue', async () => {
  const { token } = await login('impact-review@nexo.com');
  const c = await conversation(token);
  await send(c.id, token, 'Meu teclado não funciona');
  const incomplete = await send(c.id, token, 'Confirmar e enviar');
  assert.equal(incomplete.conversation.messages.at(-1).ticketCard, undefined);
  assert.equal((await request('/tickets', token)).tickets.length, 0);
  const critical = await send(c.id, token, 'Minha equipe está parada');
  assert.equal(critical.conversation.status, 'waiting_human');
  assert.equal((await request('/tickets', token)).tickets.length, 0);
});

test('VPN answer checks operating system applicability', async () => {
  const { token } = await login('kb-review@nexo.com');
  const c = await conversation(token);
  const question = await send(c.id, token, 'VPN erro 809');
  assert.match(question.conversation.messages.at(-1).content, /Windows 10 ou Windows 11/);
  const reply = await send(c.id, token, 'VPN no Windows 11');
  assert.match(reply.conversation.messages.at(-1).content, /service desk precisa analisar/);
});


test('session signatures, API errors and production SPA routing are enforced', async () => {
  const { token } = await login();
  assert.equal((await request('/tickets', token + '.unexpected')).status, 401);
  assert.equal((await request('/analyst/conversations', token)).status, 401);
  assert.equal((await request('/missing-route', token)).status, 404);
  const invalid = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  // The integration task runs after build when checking the deploy artifact.
  const spa = await fetch(`${base}/analyst`);
  assert.equal(spa.status, 200);
  assert.match(await spa.text(), /<div id="root"><\/div>/);
});

test('session stops after 30 employee messages even during human handoff', async () => {
  const { token } = await login('message-limit@nexo.com');
  const c = await conversation(token);
  await send(c.id, token, 'Falar com analista');
  for (let i = 1; i < 30; i++) assert.equal((await send(c.id, token, `Detalhe ${i}`)).status, 200);
  assert.equal((await send(c.id, token, 'Mensagem 31')).status, 409);
});

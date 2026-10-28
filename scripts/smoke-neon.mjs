// Opt-in test against the configured Neon database. Uses isolated test employees
// and removes only records belonging to those employees, including after failure.
import '../dist-server/env.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL before running the Neon smoke test.');
const { mutateDb, readDb } = await import('../dist-server/store.js');
const suffix = randomUUID();
const owners = [`smoke-${suffix}`, `smoke-other-${suffix}`];
const emails = [`smoke-${suffix}@nexo.com`, `smoke-other-${suffix}@nexo.com`];
const remoteBase = process.env.SMOKE_BASE_URL?.replace(/\/$/, '');
if (remoteBase && !remoteBase.startsWith('https://')) throw new Error('Remote smoke test requires HTTPS.');
const analystPassword = remoteBase ? process.env.ANALYST_PASSWORD : randomUUID();
if (!analystPassword) throw new Error('Configure ANALYST_PASSWORD for the remote smoke test.');
const serverEnv = {
  ...process.env, PORT: '0', VERCEL: '', GEMINI_API_KEY: '', LEGACY_OUTAGE_MS: '0',
  ALLOW_DEMO_SIGNUP: 'false', ANALYST_PASSWORD: analystPassword, SESSION_SECRET: randomUUID(),
};
let server;
let base;
let inserted = false;

async function start() {
  if (remoteBase) { base = remoteBase; return; }
  server = spawn(process.execPath, ['dist-server/index.js'], { env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Application startup timed out.')), 15_000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Application exited during startup: ${code}`)); });
    server.stdout.on('data', chunk => {
      const url = chunk.toString().match(/http:\/\/localhost:\d+/)?.[0];
      if (url) { clearTimeout(timer); resolve(url); }
    });
    server.stderr.on('data', () => {}); // Do not leak environment or driver details.
  });
}
async function stop() {
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
}
async function request(path, token = '', body) {
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  assert.ok(response.ok, `${path}: HTTP ${response.status}; ${result.error ?? 'request failed'}`);
  return result;
}

async function redeploy() {
  const child = spawn('vercel', ['deploy', '--prod', '--yes', '--json'], {
    env: { ...process.env, VERCEL_CLI_USE_NATIVE_BINARY: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', () => {});
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, 'Production redeploy failed; inspect Vercel build logs.');
  const result = JSON.parse(output);
  assert.equal(result.deployment.readyState, 'READY');
  console.log(`PASS Production redeploy ready: ${result.deployment.id}`);
}

try {
  await mutateDb(db => {
    owners.forEach((id, i) => db.employees.push({ id, name: 'Neon Smoke Test', email: emails[i], department: 'Automated test' }));
  });
  inserted = true;
  console.log('PASS PostgreSQL connection and isolated fixture write');
  await start();
  assert.equal((await request('/health')).ok, true);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
  const { token } = await request('/login', '', { email: emails[0], password: 'smoke' });
  assert.ok((await request('/articles', token)).articles.length > 0);
  assert.equal((await request('/tickets', token)).tickets.length, 0);
  const { conversation } = await request('/conversations', token, {});
  const message = content => request(`/conversations/${conversation.id}/messages`, token, { content });
  const prepared = await message('Preciso de um monitor externo para trabalho, sem urgência.');
  assert.ok(prepared.conversation.messages.at(-1).draftCard);
  assert.equal((await request('/tickets', token)).tickets.length, 0);
  const confirmed = await message('Confirmar e enviar');
  const ticket = confirmed.conversation.messages.at(-1).ticketCard;
  assert.ok(ticket);
  assert.equal(ticket.ownerId, owners[0]);
  assert.ok((await readDb()).tickets.some(t => t.id === ticket.id && t.ownerId === owners[0]));
  console.log('PASS App startup, login, articles, draft confirmation and persisted ticket');
  const other = await request('/login', '', { email: emails[1], password: 'smoke' });
  assert.equal((await request('/tickets', other.token)).tickets.length, 0);
  assert.equal((await request('/conversations', other.token)).conversations.length, 0);
  console.log('PASS Employee isolation');

  if (remoteBase) {
    const semantic = await message('Quais registros de suporte existem em meu nome?');
    const audit = semantic.conversation.messages.at(-1).audit;
    assert.equal(audit.action, 'listar_tickets');
    assert.ok(audit.evidence.some(item => item.includes('Triagem Gemini')));
    console.log('PASS Live Gemini semantic routing and audit on deployed application');
    if (process.env.SMOKE_REDEPLOY === '1') await redeploy();
  }
  await stop(); await start();
  assert.ok((await request('/tickets', token)).tickets.some(t => t.id === ticket.id));
  assert.ok((await request('/conversations', token)).conversations.some(c => c.id === conversation.id));
  console.log(remoteBase
    ? `PASS Remote ticket and conversation persistence${process.env.SMOKE_REDEPLOY === '1' ? ' after redeploy' : ''}`
    : 'PASS Ticket and conversation survive application restart');
  assert.equal((await message('Falar com analista')).conversation.status, 'waiting_human');
  const analyst = await request('/analyst/login', '', { password: analystPassword });
  const action = (name, body = {}) => request(`/analyst/conversations/${conversation.id}/${name}`, analyst.token, body);
  await action('take');
  await action('reply', { content: 'Teste de atendimento persistido na Neon.' });
  assert.equal((await action('return')).conversation.status, 'assistant_active');
  await message('Falar com analista');
  await action('take');
  await action('close');
  assert.equal((await readDb()).conversations.find(c => c.id === conversation.id)?.status, 'closed');
  console.log('PASS Human handoff, reply, return and closure persisted in PostgreSQL');
} finally {
  await stop();
  if (inserted) {
    await mutateDb(db => {
      db.employees = db.employees.filter(e => !owners.includes(e.id));
      db.conversations = db.conversations.filter(c => !owners.includes(c.ownerId));
      db.tickets = db.tickets.filter(t => !owners.includes(t.ownerId));
    });
    const db = await readDb();
    assert.ok(!db.employees.some(e => owners.includes(e.id)));
    assert.ok(!db.conversations.some(c => owners.includes(c.ownerId)));
    assert.ok(!db.tickets.some(t => owners.includes(t.ownerId)));
    console.log('PASS Removed test fixtures; existing records preserved');
  }
}

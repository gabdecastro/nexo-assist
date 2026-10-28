import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = await mkdtemp(join(tmpdir(), 'nexo-tickets-'));
process.env.DATA_FILE = join(dir, 'db.json');
delete process.env.DATABASE_URL;
const { TicketService } = await import('../dist-server/ticket-service.js');
const { mutateDb } = await import('../dist-server/store.js');
after(() => rm(dir, { recursive: true, force: true }));
const service = new TicketService();
const draft = { title: 'Monitor externo sem imagem', description: 'Meu monitor deixou de exibir imagem.', type: 'INC', category: 'Hardware', priority: 'Alta', affectedPerson: 'Teste' };

test('same problem updates, unrelated hardware stays separate, owners remain isolated', async () => {
  const first = await service.createOrUpdate('a', draft);
  assert.equal((await service.createOrUpdate('a', draft)).ticket.id, first.ticket.id);
  assert.notEqual((await service.createOrUpdate('a', { ...draft, title: 'Notebook lento após atualização' })).ticket.id, first.ticket.id);
  assert.notEqual((await service.createOrUpdate('b', draft)).ticket.id, first.ticket.id);
  await assert.rejects(service.createOrUpdate('b', { ...draft, existingTicketId: first.ticket.id }));
});
test('recent resolution reopens and retains the entire ticket history', async () => {
  const first = await service.createOrUpdate('reopen', draft);
  await mutateDb(db => { const t = db.tickets.find(t => t.id === first.ticket.id); t.status = 'Resolvido'; t.history.push('Resolução anterior preservada'); });
  const reopened = await service.createOrUpdate('reopen', draft);
  assert.equal(reopened.ticket.id, first.ticket.id);
  assert.ok(reopened.ticket.history.includes('Resolução anterior preservada'));
  assert.match(reopened.ticket.history.at(-1), /Reaberto/);
  await mutateDb(db => { const t = db.tickets.find(t => t.id === first.ticket.id); t.status = 'Resolvido'; t.updatedAt = '2020-01-01T00:00:00Z'; });
  assert.notEqual((await service.createOrUpdate('reopen', draft)).ticket.id, first.ticket.id);
});
test('temporary outage retries without duplicating writes and exhaustion is explicit', async () => {
  process.env.LEGACY_OUTAGE_MS = '100';
  const recovering = new TicketService();
  assert.equal((await recovering.createOrUpdate('outage', draft)).updated, false);
  process.env.LEGACY_OUTAGE_MS = '5000';
  const unavailable = new TicketService();
  await assert.rejects(unavailable.createOrUpdate('outage', draft), /temporariamente indisponível/);
  assert.equal((await service.listFor('outage')).length, 1);
  delete process.env.LEGACY_OUTAGE_MS;
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mutateSnapshot } from '../dist-server/snapshot-store.js';

test('independent instances retry version conflicts without losing changes', async () => {
  let current = { revision: 0, data: { conversations: [], employees: [], articles: [], tickets: [] } };
  let conflicts = 0;
  const driver = {
    async read() { return structuredClone(current); },
    async compareAndSwap(revision, data) {
      if (revision !== current.revision) { conflicts++; return false; }
      current = { revision: revision + 1, data: structuredClone(data) }; return true;
    },
  };
  await Promise.all(Array.from({ length: 5 }, (_, i) => mutateSnapshot(driver, db => db.conversations.push({ id: String(i) }))));
  assert.equal(current.data.conversations.length, 5);
  assert.ok(conflicts > 0);
});
test('unknown network write outcome is not automatically replayed', async () => {
  let writes = 0;
  const driver = {
    async read() { return { revision: 0, data: {} }; },
    async compareAndSwap() { writes++; throw new Error('network'); },
  };
  await assert.rejects(mutateSnapshot(driver, () => {}), /network/);
  assert.equal(writes, 1);
});

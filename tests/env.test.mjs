import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment } from '../dist-server/env.js';

test('Neon .env.local is loaded without overriding injected config or offline test isolation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-env-'));
  try {
    await writeFile(join(directory, '.env.local'), 'DATABASE_URL=postgresql://local.invalid/db\nNEON_BRANCH=test-branch\n');
    await writeFile(join(directory, '.env'), 'DATABASE_URL=postgresql://fallback.invalid/db\nPORT=3001\n');
    const fresh = {};
    loadEnvironment(directory, fresh);
    assert.equal(fresh.DATABASE_URL, 'postgresql://local.invalid/db');
    assert.equal(fresh.NEON_BRANCH, 'test-branch');
    assert.equal(fresh.PORT, '3001');
    const injected = { DATABASE_URL: '', PORT: '0' };
    loadEnvironment(directory, injected);
    assert.equal(injected.DATABASE_URL, '');
    assert.equal(injected.PORT, '0');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

import { neon } from '@neondatabase/serverless';
import type { Database } from './types.js';
import type { SnapshotDriver } from './snapshot-store.js';

export function createNeonStore(url: string, seed: () => Database): SnapshotDriver {
  const sql = neon(url);
  let ready: Promise<void> | undefined;
  const initialize = () => ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS nexo_state (id integer PRIMARY KEY CHECK (id = 1), revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL)`;
    await sql`INSERT INTO nexo_state (id, data) VALUES (1, ${JSON.stringify(seed())}::jsonb) ON CONFLICT (id) DO NOTHING`;
  })().catch(error => { ready = undefined; throw error; });
  return {
    async read() {
      await initialize();
      const rows = await sql`SELECT data, revision FROM nexo_state WHERE id = 1`;
      const row = rows[0];
      if (!row) throw new Error('Estado do banco indisponível.');
      return { data: row.data as Database, revision: Number(row.revision) };
    },
    async compareAndSwap(revision, data) {
      const rows = await sql`UPDATE nexo_state SET data = ${JSON.stringify(data)}::jsonb, revision = revision + 1 WHERE id = 1 AND revision = ${revision} RETURNING revision`;
      return rows.length === 1;
    },
  };
}

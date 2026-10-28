import type { Database } from './types.js';

export interface Snapshot { data: Database; revision: number }
export interface SnapshotDriver {
  read(): Promise<Snapshot>;
  compareAndSwap(revision: number, data: Database): Promise<boolean>;
}

// Retry only version conflicts. Callback must only mutate its supplied snapshot.
// Network errors are surfaced, since the result of a write may be uncertain.
export async function mutateSnapshot<T>(driver: SnapshotDriver, fn: (db: Database) => T | Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, revision } = await driver.read();
    const result = await fn(data);
    if (await driver.compareAndSwap(revision, data)) return result;
    await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
  }
  throw new Error('Muitas alterações simultâneas. Tente novamente.');
}

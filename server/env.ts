import { config } from 'dotenv';
import { resolve } from 'node:path';

// Neon CLI writes .env.local. Injected environment variables always take priority,
// including an explicit empty DATABASE_URL used to isolate offline tests.
export function loadEnvironment(directory = process.cwd(), target?: Record<string, string>): void {
  config({ path: [resolve(directory, '.env.local'), resolve(directory, '.env')], ...(target ? { processEnv: target } : {}) });
}

loadEnvironment();

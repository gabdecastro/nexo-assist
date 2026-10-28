import type { Priority } from './types.js';

// Calendar agreed for this demo: Mon–Fri, 08–18, UTC−03 (São Paulo), no holidays.
// A business day is ten service hours. Critical incidents run 24×7.
export function deadline(priority: Priority, from = new Date()): string {
  if (priority === 'Crítica') return new Date(from.getTime() + 3_600_000).toISOString();
  let remaining = (priority === 'Alta' ? 4 : priority === 'Média' ? 30 : 50) * 3_600_000;
  const local = new Date(from.getTime() - 3 * 3_600_000);
  while (remaining > 0) {
    if (local.getUTCDay() === 0 || local.getUTCDay() === 6 || local.getUTCHours() >= 18) {
      local.setUTCDate(local.getUTCDate() + 1); local.setUTCHours(8, 0, 0, 0); continue;
    }
    if (local.getUTCHours() < 8) local.setUTCHours(8, 0, 0, 0);
    const closing = new Date(local); closing.setUTCHours(18, 0, 0, 0);
    const used = Math.min(remaining, closing.getTime() - local.getTime());
    local.setTime(local.getTime() + used); remaining -= used;
  }
  return new Date(local.getTime() + 3 * 3_600_000).toISOString();
}

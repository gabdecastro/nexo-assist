import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadline } from '../dist-server/sla.js';

test('high SLA crosses weekend using São Paulo business hours', () => {
  assert.equal(deadline('Alta', new Date('2026-10-30T20:00:00Z')), '2026-11-02T14:00:00.000Z');
  assert.equal(deadline('Alta', new Date('2026-10-31T14:00:00Z')), '2026-11-02T15:00:00.000Z');
});
test('medium and low deadlines use 3 and 5 ten-hour service days', () => {
  assert.equal(deadline('Média', new Date('2026-10-28T11:00:00Z')), '2026-10-30T21:00:00.000Z');
  assert.equal(deadline('Baixa', new Date('2026-10-28T11:00:00Z')), '2026-11-03T21:00:00.000Z');
});
test('critical SLA runs continuously including weekends', () => {
  assert.equal(deadline('Crítica', new Date('2026-10-31T23:45:00Z')), '2026-11-01T00:45:00.000Z');
});

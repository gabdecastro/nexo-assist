import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'nexo-llm-'));
process.env.DATA_FILE = join(dir, 'db.json');
delete process.env.DATABASE_URL;
const { understand, parseUnderstanding } = await import('../dist-server/llm.js');
after(() => rm(dir, { recursive: true, force: true }));
const articles = [{ id: 'KB-1', title: 'Senha', content: 'Use o portal', tags: ['senha'] }];
test('provider output is validated and cannot invent article IDs', () => {
  assert.throws(() => parseUnderstanding({ intent: 'delete', confidence: 1, articleId: '', reason: '' }, articles));
  assert.throws(() => parseUnderstanding({ intent: 'knowledge', confidence: 1, articleId: 'private-ticket', reason: '' }, articles));
});
test('Gemini request is bounded, uses structured output and stops at persisted daily cap', async t => {
  process.env.GEMINI_API_KEY = 'test-only'; process.env.LLM_DAILY_LIMIT = '1';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com/);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.maxOutputTokens, 350);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'knowledge', articleId: 'KB-1', confidence: 0.9, reason: 'Artigo de senha' }) }] } }] });
  });
  assert.equal((await understand('Como recuperar minha credencial?', articles)).articleId, 'KB-1');
  await assert.rejects(understand('Outra dúvida', articles), /Limite diário/);
  assert.equal(calls, 1);
  delete process.env.GEMINI_API_KEY;
});

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


test('LangGraph uses semantic intent and exposes provider evidence without exposing other owners', async t => {
  process.env.GEMINI_API_KEY = 'test-only'; process.env.LLM_DAILY_LIMIT = '2';
  const { mutateDb, timestamp } = await import('../dist-server/store.js');
  const { AgentService } = await import('../dist-server/agent.js');
  const id = 'semantic-graph-test';
  await mutateDb(db => db.conversations.push({ id, ownerId: 'emp-ana', status: 'assistant_active', messages: [], createdAt: timestamp(), updatedAt: timestamp() }));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: 'list', articleId: '', confidence: 0.95, reason: 'Pessoa quer consultar os registros próprios.' }) }] } }] }));
  const result = await new AgentService().respond(id, 'emp-ana', 'Quais registros de suporte existem em meu nome?');
  assert.equal(result.messages.at(-1).audit.action, 'listar_tickets');
  assert.ok(result.messages.at(-1).audit.evidence.some(text => text.includes('Triagem Gemini')));
  assert.ok(!result.messages.at(-1).quickReplies.includes('INC-20914'));
  delete process.env.GEMINI_API_KEY;
});

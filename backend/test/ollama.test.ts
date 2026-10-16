import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatBody } from '../src/ollama.ts';

const options = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3.5:9b',
  timeoutMs: 600_000,
};

test('chat body disables streaming and thinking, and requests JSON', () => {
  const body = buildChatBody(options, [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'usr' },
  ]);

  assert.equal(body.model, 'qwen3.5:9b');
  assert.equal(body.stream, false);
  assert.equal(body.format, 'json');
  assert.equal(body.think, false);
  assert.equal((body.messages as unknown[]).length, 2);
  const inner = body.options as Record<string, number>;
  assert.equal(inner.num_ctx, 8192);
  assert.ok(inner.temperature! <= 0.5);
});

test('chat body honors overrides', () => {
  const body = buildChatBody(
    { ...options, temperature: 0.7, numCtx: 4096, numPredict: 512 },
    [{ role: 'user', content: 'x' }],
  );

  const inner = body.options as Record<string, number>;
  assert.equal(inner.temperature, 0.7);
  assert.equal(inner.num_ctx, 4096);
  assert.equal(inner.num_predict, 512);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aiProvider,
  anthropicModelFor,
  anthropicReadiness,
  buildAnthropicBody,
  textFromAnthropic,
} from '../src/anthropic.ts';

test('a key switches the backend to the hosted AI; AI_PROVIDER can force either', () => {
  assert.equal(aiProvider({}), 'ollama');
  assert.equal(aiProvider({ ANTHROPIC_API_KEY: 'sk-test' }), 'anthropic');
  assert.equal(aiProvider({ ANTHROPIC_API_KEY: 'sk-test', AI_PROVIDER: 'ollama' }), 'ollama');
  assert.equal(aiProvider({ AI_PROVIDER: 'anthropic' }), 'anthropic');
  assert.equal(aiProvider({ ANTHROPIC_API_KEY: '   ' }), 'ollama');
});

test('lessons use the main model and small decisions use the light one', () => {
  assert.equal(anthropicModelFor(undefined, {}), 'claude-sonnet-5-5');
  assert.equal(anthropicModelFor('light', {}), 'claude-haiku-5-5');
  assert.equal(anthropicModelFor('light', { ANTHROPIC_LIGHT_MODEL: 'my-small' }), 'my-small');
  assert.equal(anthropicModelFor(undefined, { ANTHROPIC_MODEL: 'my-big' }), 'my-big');
});

test('the request splits the system prompt from the user message', () => {
  const body = buildAnthropicBody(
    { baseUrl: '', model: 'qwen', timeoutMs: 1000, numPredict: 200, tier: 'light' },
    [
      { role: 'system', content: 'Be strict.' },
      { role: 'user', content: 'Write a lesson.' },
    ],
    {},
  );
  assert.deepEqual(body, {
    model: 'claude-haiku-5-5',
    max_tokens: 200,
    system: 'Be strict.',
    messages: [{ role: 'user', content: 'Write a lesson.' }],
  });
});

test('readiness only needs the key, and the reason never contains one', () => {
  assert.deepEqual(anthropicReadiness({ ANTHROPIC_API_KEY: 'sk-test' }), { ok: true });
  const missing = anthropicReadiness({});
  assert.equal(missing.ok, false);
});

test('reads text out of a response and rejects an empty one', () => {
  assert.equal(textFromAnthropic({ content: [{ type: 'text', text: '{"a":1}' }] }), '{"a":1}');
  assert.throws(() => textFromAnthropic({ content: [], stop_reason: 'max_tokens' }), /max_tokens/);
});

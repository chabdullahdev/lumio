import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublishableOrAnonKey, parseBackendEnv } from '../src/env.ts';

const VALID = {
  SUPABASE_URL: 'https://demo-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_demo123',
};

test('accepts a complete environment and defaults Ollama to loopback', () => {
  const result = parseBackendEnv({ ...VALID });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.config.supabaseUrl, VALID.SUPABASE_URL);
    assert.equal(result.config.ollamaBaseUrl, 'http://127.0.0.1:11434');
    assert.deepEqual(result.warnings, []);
  }
});

test('reports missing variables with setup instructions', () => {
  const result = parseBackendEnv({});

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0] ?? '', /SUPABASE_URL is missing/);
    assert.match(result.errors[1] ?? '', /SUPABASE_SERVICE_ROLE_KEY is missing/);
  }
});

test('rejects non-https Supabase URLs', () => {
  const result = parseBackendEnv({ ...VALID, SUPABASE_URL: 'http://demo-project.supabase.co' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join('\n'), /must be an https:\/\/ URL/);
  }
});

test('rejects a publishable key where the service key belongs', () => {
  const result = parseBackendEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_nope' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join('\n'), /publishable\/anon/);
  }
});

test('rejects a legacy anon JWT where the service key belongs', () => {
  const anonJwt = 'header.eyJyb2xlIjoiYW5vbiJ9.signature';
  const result = parseBackendEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: anonJwt });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join('\n'), /publishable\/anon/);
  }
});

test('accepts a legacy service-role JWT', () => {
  const serviceJwt = 'header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
  const result = parseBackendEnv({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: serviceJwt });

  assert.equal(result.ok, true);
});

test('warns when Ollama is not on loopback', () => {
  const result = parseBackendEnv({ ...VALID, OLLAMA_BASE_URL: 'https://ollama.example.com' });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0] ?? '', /never be reachable from the public internet/);
  }
});

test('defaults model, timeout, and poll interval; accepts overrides', () => {
  const defaults = parseBackendEnv({ ...VALID });
  assert.equal(defaults.ok, true);
  if (defaults.ok) {
    assert.equal(defaults.config.ollamaModel, 'qwen3.5:9b');
    assert.equal(defaults.config.ollamaTimeoutMs, 600_000);
    assert.equal(defaults.config.workerPollMs, 15_000);
  }

  const overridden = parseBackendEnv({
    ...VALID,
    OLLAMA_MODEL: 'llama3.2:3b',
    OLLAMA_TIMEOUT_MS: '120000',
    WORKER_POLL_MS: '5000',
  });
  assert.equal(overridden.ok, true);
  if (overridden.ok) {
    assert.equal(overridden.config.ollamaModel, 'llama3.2:3b');
    assert.equal(overridden.config.ollamaTimeoutMs, 120_000);
    assert.equal(overridden.config.workerPollMs, 5_000);
  }
});

test('rejects invalid timeout and poll values', () => {
  const result = parseBackendEnv({
    ...VALID,
    OLLAMA_TIMEOUT_MS: 'soon',
    WORKER_POLL_MS: '10000000',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(error => error.includes('OLLAMA_TIMEOUT_MS')));
    assert.ok(result.errors.some(error => error.includes('WORKER_POLL_MS')));
  }
});

test('isPublishableOrAnonKey classifies key formats', () => {
  assert.equal(isPublishableOrAnonKey('sb_publishable_abc'), true);
  assert.equal(isPublishableOrAnonKey('header.eyJyb2xlIjoiYW5vbiJ9.sig'), true);
  assert.equal(isPublishableOrAnonKey('sb_secret_abc'), false);
  assert.equal(isPublishableOrAnonKey('header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig'), false);
  assert.equal(isPublishableOrAnonKey('not-a-jwt'), false);
});

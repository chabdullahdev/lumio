/**
 * Environment check for the backend. Run with `npm run check` (loads
 * backend/.env when present, via `node --env-file-if-exists`).
 *
 * Prints a safe summary — secrets are never echoed, only their presence and
 * length — and exits non-zero when the configuration is invalid.
 */
import { loadBackendEnv } from './env.ts';
import { checkOllama } from './ollama-health.ts';

async function main(): Promise<number> {
  try {
    const config = loadBackendEnv();
    console.log('LUMIO backend environment is valid.');
    console.log(`  SUPABASE_URL             ${config.supabaseUrl}`);
    console.log(
      `  SUPABASE_SERVICE_ROLE_KEY set (${config.supabaseServiceRoleKey.length} characters)`,
    );
    console.log(`  OLLAMA_BASE_URL          ${config.ollamaBaseUrl}`);
    console.log(`  OLLAMA_MODEL             ${config.ollamaModel}`);
    console.log(`  OLLAMA_TIMEOUT_MS        ${config.ollamaTimeoutMs}`);
    console.log(`  WORKER_POLL_MS           ${config.workerPollMs}`);
    const health = await checkOllama(config.ollamaBaseUrl, config.ollamaModel);
    console.log(`  Local AI                 ${health.ok ? 'ready' : `NOT READY - ${health.reason}`}`);
    return health.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\nHint: copy backend/.env.example to backend/.env and fill in the values.');
    return 1;
  }
}

process.exitCode = await main();

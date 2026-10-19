/**
 * The librarian: keeps the knowledge library growing on its own.
 *
 * Each round it takes the next LUMIO category in turn and
 *   1. checks the local AI is up (waits if not),
 *   2. lets the AI choose new public-domain books  (discover-books.ts --curate),
 *   3. downloads and converts them                 (discover-books.ts --fetch),
 *   4. saves them to Supabase                      (store-books.ts --apply),
 * then sleeps until the next round. The steps are the same scripts you can run
 * by hand, so a failure in one never needs special recovery: the next round
 * simply picks up whatever is left (every step skips finished work).
 *
 * Usage (from backend/):
 *   npm run librarian                  # keep going; Ctrl+C to stop
 *   npm run librarian -- --once        # one round, then exit
 *   npm run librarian -- --category History --once
 *
 * Settings (backend/.env, all optional):
 *   LIBRARIAN_INTERVAL_MS   wait between rounds (default 1800000 = 30 minutes)
 *   LIBRARIAN_PICK          books the AI may choose per round (default 5)
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_NAMES } from '../src/library/catalog.ts';
import { checkOllama } from '../src/ollama-health.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'library-data');
const stateFile = join(dataDir, 'librarian-state.json');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5:9b';
const INTERVAL_MS = Number(process.env.LIBRARIAN_INTERVAL_MS ?? 30 * 60_000);
const PICK = Number(process.env.LIBRARIAN_PICK ?? 5);
const AI_RECHECK_MS = 30_000;

type State = { nextCategory: number; rounds: number; lastRound: string | null };

function log(message: string): void {
  console.log(`[librarian ${new Date().toISOString().slice(11, 19)}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(stateFile, 'utf8')) as State;
  } catch {
    return { nextCategory: 0, rounds: 0, lastRound: null };
  }
}

/** Run one of the scripts and stream its output. Resolves with its exit code. */
function runScript(script: string, args: string[]): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(
      process.execPath,
      ['--env-file-if-exists=.env', join('scripts', script), ...args],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    child.on('error', () => resolve(1));
    child.on('close', code => resolve(code ?? 1));
  });
}

function hasServiceKey(): boolean {
  const file = join(root, '.env');
  return existsSync(file) && /^SUPABASE_SERVICE_ROLE_KEY=\S+/m.test(readFileSync(file, 'utf8'));
}

async function waitForAi(isStopping: () => boolean): Promise<boolean> {
  let warned = false;
  while (!isStopping()) {
    const health = await checkOllama(OLLAMA_URL, MODEL);
    if (health.ok) {
      if (warned) {
        log('the local AI is ready again');
      }
      return true;
    }
    if (!warned) {
      log(`waiting for the local AI: ${health.reason}`);
      warned = true;
    }
    await sleep(AI_RECHECK_MS);
  }
  return false;
}

async function round(category: string): Promise<void> {
  log(`round for ${category}`);
  const picked = await runScript('discover-books.ts', ['--category', category, '--curate', '--pick', String(PICK), '--model', MODEL]);
  if (picked !== 0) {
    log(`choosing books failed (exit ${picked}); will retry next round`);
    return;
  }
  const fetched = await runScript('discover-books.ts', ['--category', category, '--fetch']);
  if (fetched !== 0) {
    log(`converting books failed (exit ${fetched}); will retry next round`);
  }
  if (!hasServiceKey()) {
    log('books converted but NOT saved: backend/.env has no SUPABASE_SERVICE_ROLE_KEY on this machine');
    return;
  }
  const stored = await runScript('store-books.ts', ['--apply']);
  log(stored === 0 ? 'saved to Supabase' : `saving to Supabase had problems (exit ${stored}); see above`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const once = argv.includes('--once');
  const only = argv.includes('--category') ? argv[argv.indexOf('--category') + 1] : null;
  if (only && !(CATEGORY_NAMES as readonly string[]).includes(only)) {
    throw new Error(`--category must be one of: ${CATEGORY_NAMES.join(', ')}.`);
  }

  let stopping = false;
  const stop = (signal: string): void => {
    if (!stopping) {
      stopping = true;
      log(`received ${signal}; finishing the current step and exiting`);
    }
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  log(`started (model ${MODEL}, ${PICK} books per round, every ${Math.round(INTERVAL_MS / 60_000)} min)`);
  await mkdir(dataDir, { recursive: true });

  do {
    if (!(await waitForAi(() => stopping))) {
      break;
    }
    const state = await loadState();
    const category = only ?? CATEGORY_NAMES[state.nextCategory % CATEGORY_NAMES.length];
    try {
      await round(category);
    } catch (error) {
      log(`round failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await writeFile(
      stateFile,
      `${JSON.stringify({ nextCategory: (state.nextCategory + 1) % CATEGORY_NAMES.length, rounds: state.rounds + 1, lastRound: new Date().toISOString() }, null, 2)}\n`,
    );
    if (!once && !stopping) {
      await sleep(INTERVAL_MS);
    }
  } while (!once && !stopping);
  log('stopped');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

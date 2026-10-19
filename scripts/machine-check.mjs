/**
 * Checks that this computer is ready to work on LUMIO, and says exactly what
 * is missing. Run it after cloning or pulling on a second machine:
 *
 *   npm run doctor
 *
 * It only reads things. It never prints secrets, only whether they are set.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MODEL = 'qwen3.5:9b';
let problems = 0;

function ok(message) {
  console.log(`  ✔ ${message}`);
}

function bad(message, fix) {
  problems += 1;
  console.log(`  ✖ ${message}\n      fix: ${fix}`);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function hasValue(file, name) {
  if (!existsSync(file)) {
    return false;
  }
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find(entry => entry.startsWith(`${name}=`));
  return Boolean(line && line.slice(name.length + 1).trim());
}

console.log('Tools');
const major = Number(process.versions.node.split('.')[0]);
major >= 22 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} is too old`, 'install Node 22.11 or newer');
const git = run('git', ['--version']);
git ? ok(git) : bad('git not found', 'install git');

console.log('Git identity (so commits show your GitHub account)');
const name = run('git', ['-C', root, 'config', 'user.name']);
const email = run('git', ['-C', root, 'config', 'user.email']);
name && email
  ? ok(`${name} <${email}>`)
  : bad('no git name/email set', 'git config user.name "<name>" && git config user.email "<email>"  (run inside this project)');

console.log('Installed packages');
existsSync(join(root, 'node_modules')) ? ok('app packages') : bad('app packages missing', 'npm install');
existsSync(join(root, 'backend', 'node_modules')) ? ok('backend packages') : bad('backend packages missing', 'cd backend && npm install');
existsSync(join(root, 'webapp', 'node_modules')) ? ok('web app packages') : bad('web app packages missing', 'cd webapp && npm install');

console.log('Secret files (never in git, copy them from your other machine)');
hasValue(join(root, '.env'), 'SUPABASE_URL') && hasValue(join(root, '.env'), 'SUPABASE_PUBLISHABLE_KEY')
  ? ok('.env (app)')
  : bad('.env missing or empty', 'copy .env from the other machine, or cp .env.example .env and fill it in');
hasValue(join(root, 'webapp', '.env.local'), 'VITE_SUPABASE_URL') && hasValue(join(root, 'webapp', '.env.local'), 'VITE_SUPABASE_PUBLISHABLE_KEY')
  ? ok('webapp/.env.local (web app)')
  : bad('webapp/.env.local missing or empty', 'cp webapp/.env.example webapp/.env.local and fill in the same URL and publishable key as .env');
hasValue(join(root, 'backend', '.env'), 'SUPABASE_SERVICE_ROLE_KEY')
  ? ok('backend/.env (worker)')
  : bad('backend/.env missing or empty', 'copy backend/.env from the other machine (it holds the secret key)');
existsSync(join(root, 'android', 'app', 'lumio-release.keystore')) && existsSync(join(root, 'android', 'keystore.properties'))
  ? ok('Android signing key')
  : bad('Android signing key missing (only needed to publish app updates)', 'copy android/app/lumio-release.keystore and android/keystore.properties from the other machine');

console.log('Local AI');
const models = run('ollama', ['list']);
if (models === null) {
  bad('Ollama is not installed or not running', 'install Ollama from ollama.com and start it');
} else {
  models.split('\n').some(line => line.startsWith(`${MODEL} `) || line.startsWith(`${MODEL}\t`))
    ? ok(`model ${MODEL}`)
    : bad(`model ${MODEL} not downloaded`, `ollama pull ${MODEL}`);
}

console.log(problems === 0 ? '\nAll good. This machine is ready.' : `\n${problems} thing(s) to fix, see above.`);
process.exitCode = problems === 0 ? 0 : 1;

/**
 * Publish an Android build to the LUMIO update channel.
 *
 * Uploads the release APK plus a `latest.json` manifest to the public
 * `app-releases` bucket in Supabase (created by migration 15). Installed apps
 * check that manifest on launch and offer the update when its versionCode is
 * newer than the installed one.
 *
 * Usage (after a release build):
 *   npm run release:publish                 # uses android/app/build/outputs/apk/release/app-release.apk
 *   npm run release:publish -- --apk path/to/app-release.apk
 *   npm run release:publish -- --force      # allow replacing a newer publication
 *
 * The script reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * backend/.env (via `node --env-file-if-exists=backend/.env`, wired up in
 * package.json). The service-role key bypasses RLS, so it is only ever used
 * here — never in the mobile app.
 *
 * Safety checks before uploading (fail loudly rather than breaking updates):
 *   - the APK's package id must be com.lumio.app;
 *   - its versionCode must match android/app/build.gradle;
 *   - it must be signed with the release keystore in android/keystore.properties
 *     (a debug-signed APK can never update a release-signed install);
 *   - never replace a newer published build unless --force is passed.
 * The tool checks use Android SDK build-tools when available; if they cannot
 * run, the script warns instead of blocking.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BUCKET = 'app-releases';
const APP_ID = 'com.lumio.app';
const DEFAULT_APK = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`⚠ ${message}`);
}

function run(command, args) {
  // Windows batch wrappers (apksigner.bat) need a shell; with a shell, Node
  // does not quote arguments itself, so quote anything with whitespace.
  const useShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(command);
  const finalArgs = useShell ? args.map(arg => (/\s/.test(arg) ? `"${arg}"` : arg)) : args;
  return execFileSync(command, finalArgs, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: useShell,
  });
}

function androidSdkDir() {
  const localProperties = join(root, 'android', 'local.properties');
  if (!existsSync(localProperties)) {
    return null;
  }
  for (const line of readFileSync(localProperties, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^sdk\.dir=(.+)$/);
    if (match) {
      // Properties files escape ':' and '\' (for example `D\:\\Android\\Sdk`).
      return match[1].trim().replace(/\\\\/g, '\\').replace(/\\:/g, ':');
    }
  }
  return null;
}

/** Newest Android build-tools file matching one of these relative paths. */
function findInBuildTools(relativePaths) {
  const sdkDir = androidSdkDir();
  if (!sdkDir) {
    return null;
  }
  const buildToolsDir = join(sdkDir, 'build-tools');
  if (!existsSync(buildToolsDir)) {
    return null;
  }
  const versions = readdirSync(buildToolsDir).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  for (const version of versions) {
    for (const relativePath of relativePaths) {
      const candidate = join(buildToolsDir, version, relativePath);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function findAapt() {
  return findInBuildTools(process.platform === 'win32' ? ['aapt.exe', 'aapt'] : ['aapt']);
}

function findJava() {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java';
  if (process.env.JAVA_HOME) {
    const candidate = join(process.env.JAVA_HOME, 'bin', executable);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return 'java'; // resolved from PATH
}

function readKeystoreProperties() {
  const file = join(root, 'android', 'keystore.properties');
  if (!existsSync(file)) {
    return null;
  }
  const properties = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator !== -1) {
      properties[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
    }
  }
  return properties;
}

function normalizeFingerprint(value) {
  return value.replace(/[^0-9a-f]/gi, '').toLowerCase();
}

/** Refuse to publish an APK that does not match this project and version. */
function verifyApkIdentity(apkPath, expectedVersionCode) {
  const aapt = findAapt();
  if (!aapt) {
    warn('aapt not found in the Android SDK build-tools; skipping the APK identity check.');
    return;
  }
  let badging;
  try {
    badging = run(aapt, ['dump', 'badging', apkPath]);
  } catch (error) {
    warn(`Could not inspect the APK with aapt (${error.message}); skipping the identity check.`);
    return;
  }
  const match = badging.match(/package: name='([^']+)' versionCode='(\d+)'/);
  if (!match) {
    fail('Could not read the APK package identity. Rebuild the release APK and try again.');
  }
  const [, packageName, versionCode] = match;
  if (packageName !== APP_ID) {
    fail(
      `The APK is "${packageName}", not "${APP_ID}".\n` +
        'It is probably a stale build from the old app identity. Rebuild it first.',
    );
  }
  if (Number(versionCode) !== expectedVersionCode) {
    fail(
      `The APK is versionCode ${versionCode}, but android/app/build.gradle says ${expectedVersionCode}.\n` +
        'Rebuild the release APK so the two match.',
    );
  }
}

/**
 * Refuse to publish a build signed with a different key than the one installed
 * apps trust. Without this, an update download would fail at install time.
 */
function verifyApkSignature(apkPath) {
  const properties = readKeystoreProperties();
  if (!properties) {
    fail(
      'android/keystore.properties is missing, so the release APK was signed with the debug key.\n' +
        'Restore the release keystore before publishing — a debug-signed APK cannot update an installed release build.',
    );
  }

  const apksignerJar = findInBuildTools([join('lib', 'apksigner.jar')]);
  if (!apksignerJar) {
    warn('apksigner.jar not found in the Android SDK build-tools; skipping the signature check.');
    return;
  }

  const keytool = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
    : 'keytool';

  let expectedFingerprint;
  let actualFingerprint;
  try {
    const keystorePath = join(root, 'android', 'app', properties.storeFile);
    const listed = run(keytool, [
      '-list',
      '-v',
      '-keystore',
      keystorePath,
      '-storepass',
      properties.storePassword,
      '-alias',
      properties.keyAlias,
    ]);
    const expectedMatch = listed.match(/SHA256:\s*([0-9A-F:]+)/i);
    if (!expectedMatch) {
      warn('Could not read the release certificate fingerprint; skipping the signature check.');
      return;
    }
    expectedFingerprint = normalizeFingerprint(expectedMatch[1]);

    const verified = run(findJava(), ['-jar', apksignerJar, 'verify', '--print-certs', apkPath]);
    const actualMatch = verified.match(/certificate SHA-256 digest:\s*([0-9a-f]+)/i);
    if (!actualMatch) {
      warn('Could not read the APK signer certificate; skipping the signature check.');
      return;
    }
    actualFingerprint = normalizeFingerprint(actualMatch[1]);
  } catch (error) {
    warn(`Could not verify the APK signature (${error.message}); skipping the check.`);
    return;
  }

  if (expectedFingerprint !== actualFingerprint) {
    fail(
      'The APK is NOT signed with the release keystore in android/keystore.properties.\n' +
        'Installed apps would refuse this update. Rebuild with the release keystore present.',
    );
  }
}

const args = process.argv.slice(2);
const apkIndex = args.indexOf('--apk');
const apkPath = apkIndex !== -1 ? args[apkIndex + 1] : DEFAULT_APK;
const force = args.includes('--force');

if (!apkPath || !existsSync(apkPath)) {
  fail(
    `APK not found at ${apkPath ?? '(missing path)'}.\n` +
      'Build the release APK first (Ship Studio: reopen the project to trigger a native rebuild).',
  );
}

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  fail(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      'Create backend/.env from backend/.env.example and fill in the service-role key.',
  );
}

const gradle = readFileSync(join(root, 'android', 'app', 'build.gradle'), 'utf8');
const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) ?? [])[1]);
const versionName = (gradle.match(/versionName\s+"([^"]+)"/) ?? [])[1];
if (!Number.isInteger(versionCode) || !versionName) {
  fail('Could not read versionCode/versionName from android/app/build.gradle.');
}

verifyApkIdentity(apkPath, versionCode);
verifyApkSignature(apkPath);

const apk = readFileSync(apkPath);
const size = statSync(apkPath).size;
const sha256 = createHash('sha256').update(apk).digest('hex');
const objectName = `lumio-${versionCode}.apk`;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Never roll the channel backwards without an explicit --force.
const { data: existingManifest } = await supabase.storage.from(BUCKET).download('latest.json');
if (existingManifest && !force) {
  try {
    const existing = JSON.parse(await existingManifest.text());
    if (typeof existing.versionCode === 'number' && existing.versionCode > versionCode) {
      fail(
        `Published versionCode ${existing.versionCode} is newer than this build (${versionCode}).\n` +
          'Bump versionCode in android/app/build.gradle, or pass --force to override the channel.',
      );
    }
  } catch {
    // A corrupt manifest should not block a release.
  }
}

console.log(
  `Uploading ${basename(apkPath)} — LUMIO ${versionName} (versionCode ${versionCode}), ` +
    `${(size / 1048576).toFixed(1)} MB, sha256 ${sha256.slice(0, 16)}…`,
);

const { error: apkError } = await supabase.storage.from(BUCKET).upload(objectName, apk, {
  contentType: 'application/vnd.android.package-archive',
  upsert: true,
  cacheControl: '3600',
});
if (apkError) {
  fail(`APK upload failed: ${apkError.message}`);
}

const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
const manifest = {
  versionCode,
  versionName,
  size,
  sha256,
  url: publicUrl.publicUrl,
  publishedAt: new Date().toISOString(),
};

const { error: manifestError } = await supabase.storage
  .from(BUCKET)
  .upload('latest.json', JSON.stringify(manifest, null, 2), {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '60',
  });
if (manifestError) {
  fail(`Manifest upload failed: ${manifestError.message}`);
}

console.log(`\n✔ Published LUMIO ${versionName} (versionCode ${versionCode})`);
console.log(`  APK:      ${publicUrl.publicUrl}`);
console.log(`  Manifest: ${supabaseUrl}/storage/v1/object/public/${BUCKET}/latest.json`);
console.log('  Installed apps will offer the update on their next launch.');

/**
 * Validates every SQL migration under supabase/migrations by parsing it with
 * PostgreSQL's real parser (libpg_query, via pgsql-parser).
 *
 * This is a syntax check only — it catches malformed SQL without a database
 * connection. Semantic validation (objects, privileges, dry-run) happens
 * against the actual Supabase project once migrations are applied.
 *
 * Run with: npm run validate:migrations
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadModule, parse } from 'pgsql-parser';

const migrationsDir = path.resolve(import.meta.dirname, '..', '..', 'supabase', 'migrations');

async function main(): Promise<number> {
  let files: string[];
  try {
    files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort();
  } catch {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    return 1;
  }

  if (files.length === 0) {
    console.error(`No .sql migration files found in ${migrationsDir}`);
    return 1;
  }

  await loadModule();

  let failures = 0;
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    try {
      const result = await parse(sql);
      console.log(`ok    ${file} (${result.stmts?.length ?? 0} statements)`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL  ${file}`);
      console.error(`      ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    failures === 0
      ? `\nAll ${files.length} migration file(s) parse cleanly.`
      : `\n${failures} of ${files.length} migration file(s) failed to parse.`,
  );
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();

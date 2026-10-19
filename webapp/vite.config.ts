import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

/**
 * The web app reuses the phone app's data layer (src/data, src/lib/dates) so
 * both apps read and write the database through exactly the same code.
 * Those files import two things that only exist on a phone; this plugin swaps
 * them for browser versions, without touching the phone app's files:
 *   ../lib/supabase                  -> src/shims/supabase.ts
 *   @react-native-async-storage/...  -> src/shims/async-storage.ts
 */
function sharedWithPhoneApp(): Plugin {
  const phoneSupabase = resolve(repo, 'src/lib/supabase');
  return {
    name: 'lumio-shared-with-phone-app',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === '@react-native-async-storage/async-storage') {
        return resolve(here, 'src/shims/async-storage.ts');
      }
      if (importer && source.startsWith('.') && resolve(dirname(importer), source) === phoneSupabase) {
        return resolve(here, 'src/shims/supabase.ts');
      }
      return null;
    },
  };
}

// The app is served under /app/ on the landing site (web/app/ after a build).
export default defineConfig({
  base: '/app/',
  plugins: [sharedWithPhoneApp(), react()],
  resolve: { alias: { '@shared': resolve(repo, 'src') } },
  server: { fs: { allow: [repo] } },
  build: { outDir: resolve(repo, 'web/app'), emptyOutDir: true, sourcemap: false },
  test: { environment: 'node' },
});

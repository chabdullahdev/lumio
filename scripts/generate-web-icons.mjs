/**
 * Renders the website's PNG icons from the original app icon artwork.
 *
 *   web/apple-touch-icon.png  180x180  (iOS home screen)
 *   web/icon-192.png          192x192  (web app manifest)
 *   web/icon-512.png          512x512  (web app manifest, structured-data logo)
 *
 * The social share card (web/og-image.png) is rendered separately from
 * scripts/og-image.html.
 *
 * Usage:  node scripts/generate-web-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const svg = readFileSync(join(root, 'public', 'LUMIO app icon.svg'));

const targets = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
for (const [name, size] of Object.entries(targets)) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(root, 'web', name));
  console.log(`wrote web/${name}`);
}

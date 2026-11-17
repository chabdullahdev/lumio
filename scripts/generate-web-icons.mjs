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

// The web app (installable PWA) ships its own copy, plus full-bleed "maskable" icons
// (no rounded corners: Android crops them into whatever shape the phone uses).
const maskable = Buffer.from(svg.toString().replace(/ rx="[\d.]+"/, ''));
for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(root, 'webapp', 'public', `icon-${size}.png`));
  await sharp(maskable, { density: 384 }).resize(size, size).png().toFile(join(root, 'webapp', 'public', `maskable-${size}.png`));
  console.log(`wrote webapp/public icon-${size}.png and maskable-${size}.png`);
}
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(join(root, 'webapp', 'public', 'apple-touch-icon.png'));

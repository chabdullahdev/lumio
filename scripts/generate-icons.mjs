/**
 * LUMIO icon generator.
 *
 * Renders every Android launcher icon asset (legacy square + round mipmaps,
 * adaptive-icon foreground + monochrome layers) and the in-app logo marks
 * from the designer's SVGs in `public/`:
 *
 *   - `public/LUMIO app icon.svg`  (252x252, green rounded square + ink glyph)
 *   - `public/LUMIO header logo.svg` (the mark at the left, in brand green)
 *
 * Re-run after any artwork change:  npm run icons
 *
 * The static XML files that reference these bitmaps
 * (`mipmap-anydpi-v26/ic_launcher*.xml`, `values/colors.xml`) are committed
 * and only need editing if the icon structure itself changes.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const BRAND_GREEN = '#54E36E';
const INK = '#0B2912';

/** The LUMIO mark path, from the designer's SVGs (canonical 76x76 box). */
const MARK_PATH = 'M0 5H21.28V59.72H76V81H0V5ZM38 5H76V43L38 5Z';

/** The glyph inside the 252x252 icon canvas. */
const GLYPH_PATH =
  'M59.2197 59.22H96.6165V155.383H192.78V192.78H59.2197V59.22ZM126 59.22H192.78V126L126 59.22Z';

const markSvg = (fill) =>
  `<svg width="76" height="76" viewBox="0 5 76 76" xmlns="http://www.w3.org/2000/svg"><path d="${MARK_PATH}" fill="${fill}"/></svg>`;

/**
 * Adaptive icons are drawn on a 108dp canvas, but launchers mask them (circle,
 * squircle, ...) and only the central 66dp is guaranteed to stay visible. The
 * mark is sized to this share of that safe zone so its corners are never cut.
 */
const SAFE_ZONE_DP = 66;
const CANVAS_DP = 108;
const GLYPH_SHARE_OF_SAFE_ZONE = 0.6;

/** The glyph's own bounding box in the 252-unit canvas (centred on 126,126). */
const GLYPH_BOX = 192.78 - 59.2197;
const GLYPH_SCALE =
  ((SAFE_ZONE_DP * GLYPH_SHARE_OF_SAFE_ZONE) / CANVAS_DP) * (252 / GLYPH_BOX);

const glyphSvg = (fill) =>
  `<svg width="252" height="252" viewBox="0 0 252 252" xmlns="http://www.w3.org/2000/svg"><path transform="translate(126 126) scale(${GLYPH_SCALE.toFixed(5)}) translate(-126 -126)" d="${GLYPH_PATH}" fill="${fill}"/></svg>`;

const appIconSvg = readFileSync(join(root, 'public', 'LUMIO app icon.svg'), 'utf8');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');

/** Legacy launcher icons (Android < 8): full icon, square + circle-cropped. */
const LEGACY_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/** Adaptive-icon layers (Android 8+): 108dp canvas, glyph safe inside 66dp. */
const ADAPTIVE_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

/** In-app logo marks: 1x/2x/3x for displaying up to ~96pt. */
const MARK_SIZES = { '': 96, '@2x': 192, '@3x': 288 };

async function renderIcons() {
  let written = 0;

  for (const [density, size] of Object.entries(LEGACY_SIZES)) {
    const dir = join(resDir, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });

    await sharp(Buffer.from(appIconSvg)).resize(size, size).png().toFile(join(dir, 'ic_launcher.png'));
    written += 1;

    const circle = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`,
    );
    await sharp(Buffer.from(appIconSvg))
      .resize(size, size)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));
    written += 1;
  }

  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const dir = join(resDir, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });

    await sharp(Buffer.from(glyphSvg(INK)))
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));
    written += 1;

    // Monochrome layer for Android 13+ themed icons; the system tints it.
    await sharp(Buffer.from(glyphSvg('#000000')))
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher_monochrome.png'));
    written += 1;
  }

  const assetsDir = join(root, 'src', 'assets');
  mkdirSync(assetsDir, { recursive: true });
  for (const [suffix, size] of Object.entries(MARK_SIZES)) {
    for (const [name, fill] of [
      ['logo-ink', INK],
      ['logo-green', BRAND_GREEN],
    ]) {
      await sharp(Buffer.from(markSvg(fill)))
        .resize(size, size)
        .png()
        .toFile(join(assetsDir, `${name}${suffix}.png`));
      written += 1;
    }
  }

  console.log(`Generated ${written} icon assets.`);
}

renderIcons().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

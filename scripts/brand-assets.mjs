// Generates web brand assets in public/brand/ from the source files in assets/brand-src/.
// Run with `npm run brand` after replacing a source file. Outputs are committed.
//
// logo-primary.png      square logo on white (truck mark, wordmark, tagline in three horizontal bands)
// badges-transparent.png four round badges on a transparent background (2×2 grid; bottom-right is the BH monogram)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets/brand-src';
const OUT = 'public/brand';
mkdirSync(OUT, { recursive: true });

// Bands measured from logo-primary.png (1254×1254): mark 160–731, wordmark 753–934, tagline 975–1015.
const BANDS = {
  mark: { left: 40, top: 150, width: 1060, height: 595 },
  wordmark: { left: 40, top: 743, width: 1186, height: 285 },
  full: { left: 30, top: 140, width: 1196, height: 890 },
};

/** Turn a white background into transparency, keeping anti-aliased edges ("unmultiply" white). */
async function unmatteWhite(input) {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
    if (a === 0) {
      data[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(((data[i + c] - (255 - a)) / a) * 255)));
    data[i + 3] = a;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Recolor near-black pixels to white (for the wordmark on dark backgrounds); red stays red. */
async function blackToWhite(input) {
  const { data, info } = await input.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r < 110 && g < 110 && b < 110) data[i] = data[i + 1] = data[i + 2] = 255;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** `webp: 'lossless'` suits flat logo art: smaller than lossy here and pixel-sharp. */
async function write(img, name, width, webp = { quality: 90 }) {
  const buf = await img.png().toBuffer();
  await sharp(buf).resize({ width }).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/${name}.png`);
  await sharp(buf).resize({ width }).webp(webp === 'lossless' ? { lossless: true } : webp).toFile(`${OUT}/${name}.webp`);
}

const primary = `${SRC}/logo-primary.png`;
const cut = async (band) => sharp(await (await unmatteWhite(sharp(primary).extract(band))).png().toBuffer());

// Header and footer wordmarks render at 44–52 px tall (~220 px wide); 440 px covers 2x screens.
await write(await cut(BANDS.wordmark), 'wordmark', 440, 'lossless');
await write(await blackToWhite(await cut(BANDS.wordmark)), 'wordmark-on-dark', 440, 'lossless');
await write(await cut(BANDS.mark), 'mark', 600);
await write(await cut(BANDS.full), 'logo', 512);

// Badges: split the 2×2 sheet and trim each to its circle.
const badges = sharp(`${SRC}/badges-transparent.png`);
const { width: bw, height: bh } = await badges.metadata();
const quad = (col, row) =>
  sharp(`${SRC}/badges-transparent.png`)
    .extract({ left: col * (bw / 2), top: row * (bh / 2), width: bw / 2, height: bh / 2 })
    .png()
    .toBuffer()
    .then((b) => sharp(b).trim().png().toBuffer());

const monogram = await quad(1, 1);
const darkBadge = await quad(1, 0);
await write(sharp(darkBadge), 'badge-dark', 320);
for (const [name, size] of [['favicon-32', 32], ['icon-192', 192], ['icon-512', 512]]) {
  await sharp(monogram).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${OUT}/${name}.png`);
}

// Solid-background icons for the installed app (PWA). iOS fills transparency with black, and Android "maskable"
// icons get cropped to a circle or squircle, so the badge sits inside an 80% safe zone on the night color.
const night = (await import('node:fs')).readFileSync('src/styles/tokens.css', 'utf8').match(/--color-night:\s*(#[0-9a-fA-F]{6})/)[1];
async function solidIcon(name, size, scale) {
  const inner = Math.round(size * scale);
  const badge = await sharp(monogram).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: night } })
    .composite([{ input: badge, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}.png`);
}
await solidIcon('apple-touch-icon', 180, 0.86);
for (const n of ['apple-touch-icon', 'apple-touch-icon-precomposed']) (await import('node:fs')).copyFileSync(`${OUT}/apple-touch-icon.png`, `public/${n}.png`);
await solidIcon('icon-maskable-192', 192, 0.72);
await solidIcon('icon-maskable-512', 512, 0.72);

console.log('brand: wrote', OUT);

// ── BoxHauls Driver icon: the dark badge (top right of the badge sheet) with "PICK UP. DELIVER. DONE." replaced by
// "DRIVER" in the brand display face (Saira 800 italic, drawn as outlines so no system font is needed).
// Tagline band measured on the trimmed 499 px badge: y 390–404, clear black from y 376 to 412.
{
  const opentype = (await import('opentype.js')).default;
  const font = opentype.loadSync('node_modules/@fontsource/saira/files/saira-latin-800-italic.woff');
  const W = 1000;
  const k = W / 499;
  const base = await sharp(darkBadge).resize({ width: W, kernel: 'lanczos3' }).png().toBuffer();
  const { height: H } = await sharp(base).metadata();
  const red = (await import('node:fs')).readFileSync('src/styles/tokens.css', 'utf8').match(/--color-brand:\s*(#[0-9a-fA-F]{6})/)[1];

  // Lay out "DRIVER" glyph by glyph with tracking, cap height ≈ 26 px at badge scale (the tagline's is ≈ 14).
  const size = 37 * k;
  const tracking = 0.12 * size;
  const glyphs = font.stringToGlyphs('DRIVER');
  const advance = glyphs.map((g) => (g.advanceWidth / font.unitsPerEm) * size);
  const textW = advance.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1);
  const cx = 249.5 * k;
  const baseline = 407 * k;
  let x = cx - textW / 2;
  const d = glyphs
    .map((g, i) => {
      const p = g.getPath(x, baseline, size).toPathData(2);
      x += advance[i] + tracking;
      return p;
    })
    .join(' ');
  const gap = 14 * k;
  const rule = 34 * k;
  const ruleY = baseline - 11 * k;
  const left = cx - textW / 2 - gap;
  const right = cx + textW / 2 + gap;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${68 * k}" y="${377 * k}" width="${364 * k}" height="${35 * k}" fill="#000"/>
    <rect x="${left - rule}" y="${ruleY}" width="${rule}" height="${3.5 * k}" fill="${red}"/>
    <rect x="${right}" y="${ruleY}" width="${rule}" height="${3.5 * k}" fill="${red}"/>
    <path d="${d}" fill="#fff"/>
  </svg>`;
  const driverBadge = await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await write(sharp(driverBadge), 'driver-badge', 512);

  const fit = (size) => sharp(driverBadge).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
  await (await fit(192)).toFile(`${OUT}/driver-icon-192.png`);
  await (await fit(512)).toFile(`${OUT}/driver-icon-512.png`);
  // Browser-tab icons for the driver app (the customer site keeps the BH monogram).
  await (await fit(32)).toFile(`${OUT}/driver-favicon-32.png`);
  await (await fit(48)).toFile(`${OUT}/driver-favicon-48.png`);
  async function driverSolid(name, size, scale) {
    const inner = await fit(Math.round(size * scale)).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: night } }).composite([{ input: inner, gravity: 'center' }]).png().toFile(`${OUT}/${name}.png`);
  }
  // The badge is round, so it fits Android's circular maskable safe zone at 80%.
  await driverSolid('driver-apple-touch-icon', 180, 0.94);
  // iOS also probes /apple-touch-icon.png and /apple-touch-icon-precomposed.png at the site root. driver.boxhauls.com's
  // root is /driver-app/ (functions/_middleware.ts), so the driver badge goes there too.
  mkdirSync('public/driver-app', { recursive: true });
  for (const n of ['apple-touch-icon', 'apple-touch-icon-precomposed']) (await import('node:fs')).copyFileSync(`${OUT}/driver-apple-touch-icon.png`, `public/driver-app/${n}.png`);
  await driverSolid('driver-icon-maskable-192', 192, 0.8);
  await driverSolid('driver-icon-maskable-512', 512, 0.8);
  console.log('brand: wrote BoxHauls Driver icons');
}

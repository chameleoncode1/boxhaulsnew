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

async function write(img, name, width) {
  const buf = await img.png().toBuffer();
  await sharp(buf).resize({ width }).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
  await sharp(buf).resize({ width }).webp({ quality: 90 }).toFile(`${OUT}/${name}.webp`);
}

const primary = `${SRC}/logo-primary.png`;
const cut = async (band) => sharp(await (await unmatteWhite(sharp(primary).extract(band))).png().toBuffer());

await write(await cut(BANDS.wordmark), 'wordmark', 480);
await write(await blackToWhite(await cut(BANDS.wordmark)), 'wordmark-on-dark', 480);
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
for (const [name, size] of [['favicon-32', 32], ['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) {
  await sharp(monogram).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${OUT}/${name}.png`);
}

console.log('brand: wrote', OUT);

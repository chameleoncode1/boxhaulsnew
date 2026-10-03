/**
 * Per-template Open Graph images, rendered at build (map Section 12: brand + page title; no screenshot services).
 * Colors are read from src/styles/tokens.css so the palette still lives in one file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { Page } from './sitemap';
import { templateEyebrow } from './labels';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const ogImagePath = (page: Page) => `/og/${page.slug ?? 'index'}.png`;

const root = process.cwd();
let cache: { colors: Record<string, string>; fonts: { name: string; data: Buffer; weight: 400 | 700 }[] } | undefined;

function assets() {
  if (cache) return cache;
  const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  const colors = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]));
  for (const k of ['ink', 'inverse', 'accent', 'surface-strong']) {
    if (!colors[k]) throw new Error(`OG image needs --color-${k} in tokens.css`);
  }
  const font = (w: 400 | 700) => readFileSync(join(root, `node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`));
  cache = { colors, fonts: [{ name: 'Inter', data: font(400), weight: 400 }, { name: 'Inter', data: font(700), weight: 700 }] };
  return cache;
}

type El = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): El => ({ type, props: { style, children } });

export async function renderOgImage(page: Page): Promise<Buffer> {
  const { colors: c, fonts } = assets();
  const title = page.h1.replace(/\[TODO: [^\]]+\]/g, '').trim();
  const size = title.length > 70 ? 54 : title.length > 40 ? 64 : 76;

  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px',
      backgroundColor: c.ink,
      color: c.inverse,
      fontFamily: 'Inter',
    },
    [
      el('div', { display: 'flex', fontSize: 30, color: c['surface-strong'] }, templateEyebrow(page)),
      el('div', { display: 'flex', fontSize: size, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.02em' }, title),
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 34 }, [
        el('div', { display: 'flex', fontWeight: 700 }, 'BoxHauls'),
        el('div', { display: 'flex', color: c['surface-strong'] }, 'boxhauls.com'),
      ]),
      el('div', { position: 'absolute', left: 0, top: 0, width: '100%', height: 16, backgroundColor: c.accent }),
    ],
  );

  const svg = await satori(tree as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
}

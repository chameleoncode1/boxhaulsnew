/** Token colors as hex for places that can't use CSS variables (web app manifest, theme-color meta). Read from tokens.css at build. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cache: Record<string, string> | undefined;
export function tokenColor(name: string): string {
  if (!cache) {
    const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    cache = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]));
  }
  const v = cache[name];
  if (!v) throw new Error(`--color-${name} must be a hex value in tokens.css`);
  return v;
}

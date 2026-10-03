import raw from '../../docs/placeholders.json';

type Value = string | string[] | Record<string, unknown>;
const values = raw as unknown as Record<string, Value>;

const TOKEN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** True when a placeholder value is unknown and must render as a visible TODO marker. */
export function isTodo(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase().startsWith('TODO');
}

/** Look up a placeholder by key; dotted keys reach into nested objects (e.g. SOCIAL.instagram). */
export function lookup(key: string): Value | undefined {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    values,
  ) as Value | undefined;
}

export interface Resolved {
  text: string;
  /** Placeholder keys that were missing or TODO and rendered as markers. */
  todos: string[];
}

/**
 * Substitute every {{KEY}} in `input`.
 * - Known value: replaced with the value.
 * - TODO or missing value: replaced with `[TODO: KEY]` and reported in `todos`.
 * The map writes "{{DRIVER_SHARE}}%" while the value already carries "%"; the doubled sign is collapsed.
 */
export function resolve(input: string): Resolved {
  const todos: string[] = [];
  const text = input
    .replace(TOKEN, (_, key: string) => {
      const value = lookup(key);
      if (typeof value !== 'string' || isTodo(value)) {
        todos.push(key);
        return `[TODO: ${key}]`;
      }
      return value;
    })
    .replace(/%%/g, '%');
  return { text, todos };
}

/** Substitute and return only the text. Use for URLs and other strings that must never contain markers. */
export function resolveStrict(input: string): string {
  const { text, todos } = resolve(input);
  if (todos.length) throw new Error(`Unresolved placeholder(s) ${todos.join(', ')} in "${input}"`);
  return text;
}

import type { IconId, Updater } from './types.js';

const PREFIX_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix);
}

export function isValidName(name: string): boolean {
  return NAME_RE.test(name);
}

/** Split `prefix:name`. Returns `null` for malformed ids. */
export function splitIconId(id: string): { prefix: string; name: string } | null {
  if (typeof id !== 'string') return null;
  const i = id.indexOf(':');
  if (i <= 0) return null;
  const prefix = id.slice(0, i);
  const name = id.slice(i + 1);
  if (!isValidPrefix(prefix) || !isValidName(name)) return null;
  return { prefix, name };
}

export function toIconId(prefix: string, name: string): IconId {
  return `${prefix}:${name}`;
}

export function isIconId(value: unknown): value is IconId {
  return typeof value === 'string' && splitIconId(value) !== null;
}

export function functionalUpdate<T>(updater: Updater<T>, old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater;
}

/** `chart-bar` → `Chart bar` */
export function humanizeName(name: string): string {
  const s = name.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lucide-compatible PascalCase: `arrow-up-1-0` → `ArrowUp10`. */
export function toPascalCase(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function shallowEqual(a: object, b: object): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/** Memoise a computation on a list of dependencies (compared with Object.is). */
export function memo<D extends readonly unknown[], R>(
  getDeps: () => D,
  compute: (...deps: [...D]) => R,
): () => R {
  let deps: D | undefined;
  let result: R;
  return () => {
    const next = getDeps();
    if (deps && next.length === deps.length && next.every((d, i) => Object.is(d, deps![i]))) {
      return result;
    }
    deps = next;
    result = compute(...(next as unknown as [...D]));
    return result;
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

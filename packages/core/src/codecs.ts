import type { IconId, IconValueCodec } from './types.js';
import { isValidName, splitIconId, toIconId, toPascalCase } from './utils.js';

/** Stores `prefix:name` as-is (default). Safe for mixing multiple icon libraries. */
export function prefixedCodec(): IconValueCodec<string> {
  return {
    parse(value) {
      if (typeof value !== 'string') return null;
      const v = value.trim();
      return splitIconId(v) ? (v as IconId) : null;
    },
    format(id) {
      return id;
    },
  };
}

function assertPrefix(id: IconId, prefix: string, codec: string): string {
  const parts = splitIconId(id);
  if (!parts) throw new Error(`[icon-picker] ${codec}: malformed icon id "${id}"`);
  if (parts.prefix !== prefix) {
    throw new Error(
      `[icon-picker] ${codec}({ prefix: "${prefix}" }) cannot store "${id}". ` +
        'Codecs without a prefix only support a single icon library; use prefixedCodec() to mix libraries.',
    );
  }
  return parts.name;
}

/** Stores the bare source name, e.g. `chart-bar`. Single library only. */
export function kebabCodec(options: { prefix: string }): IconValueCodec<string> {
  const { prefix } = options;
  return {
    parse(value) {
      if (typeof value !== 'string') return null;
      let v = value.trim();
      if (v.startsWith(`${prefix}:`)) v = v.slice(prefix.length + 1);
      return isValidName(v) ? toIconId(prefix, v) : null;
    },
    format(id) {
      return assertPrefix(id, prefix, 'kebabCodec');
    },
  };
}

export interface PascalCodecOptions {
  prefix: string;
  /**
   * Component name → source name lookup table (e.g. `lucideComponentNames`).
   * Generated at build time; component names cannot be reliably converted back with string rules
   * (`ArrowUp10` is `arrow-up-1-0`).
   */
  names: Readonly<Record<string, string>>;
  /** Library prefix used by some exports, e.g. `Lucide` in `LucideChartBar`. Defaults to the capitalised prefix. */
  componentPrefix?: string;
}

/** Stores component names, e.g. `ChartBar` (lucide-react). Single library only. */
export function pascalCodec(options: PascalCodecOptions): IconValueCodec<string> {
  const { prefix, names } = options;
  const componentPrefix = options.componentPrefix ?? toPascalCase(prefix);
  const lookup = (key: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(names, key) ? names[key] : undefined;

  return {
    parse(value) {
      if (typeof value !== 'string') return null;
      const v = value.trim();
      const candidates = [v];
      if (v.endsWith('Icon')) candidates.push(v.slice(0, -4));
      if (v.startsWith(componentPrefix)) candidates.push(v.slice(componentPrefix.length));
      for (const c of candidates) {
        const name = lookup(c);
        if (name) return toIconId(prefix, name);
      }
      return null;
    },
    format(id) {
      return toPascalCase(assertPrefix(id, prefix, 'pascalCodec'));
    },
  };
}

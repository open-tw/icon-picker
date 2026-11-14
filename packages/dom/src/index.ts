import type { A11yProps, IconData, IconId, IconRegistry, RecentsStorage } from '@open-tw/icon-picker-core';

export interface RenderIconOptions {
  /** Width / height. Number → px. Default 20. */
  size?: number | string;
  /** Only applies to stroke icons. Default 2. */
  strokeWidth?: number;
  /** Accessible name. Without it the icon is `aria-hidden`. */
  title?: string;
  /** Extra attributes for the `<svg>` element (e.g. `class`). */
  attrs?: Record<string, string | number | boolean | undefined | null>;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeAttr = (v: string) => v.replace(/[&<>"']/g, c => ESCAPES[c]!);
const ATTR_NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/;

function serializeAttrs(attrs: Record<string, string | number | boolean | undefined | null>): string {
  let out = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (!ATTR_NAME_RE.test(k)) continue;
    out += v === true ? ` ${k}` : ` ${k}="${escapeAttr(String(v))}"`;
  }
  return out;
}

function sizeToCss(size: number | string): string {
  return typeof size === 'number' ? `${size}px` : size;
}

/**
 * Returns an `<svg>` string. Usable with `innerHTML` or for server-side HTML.
 *
 * `data.body` is inserted as-is: only feed it trusted, build-time generated icon data.
 */
export function renderIcon(data: IconData, options: RenderIconOptions = {}): string {
  const { size = 20, strokeWidth = 2, title } = options;
  const stroke = data.style === 'stroke';
  const attrs = serializeAttrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${data.width} ${data.height}`,
    width: size,
    height: size,
    fill: stroke ? 'none' : 'currentColor',
    stroke: stroke ? 'currentColor' : undefined,
    'stroke-width': stroke ? strokeWidth : undefined,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    focusable: 'false',
    role: title ? 'img' : undefined,
    'aria-label': title,
    'aria-hidden': title ? undefined : 'true',
    'data-icon': data.id,
    ...options.attrs,
  });
  return `<svg${attrs}>${data.body}</svg>`;
}

/** Same-size empty box, used while loading and as fallback. */
export function renderPlaceholder(size: number | string = 20): string {
  const s = sizeToCss(size);
  return `<span aria-hidden="true" data-icon-placeholder style="display:inline-block;width:${s};height:${s}"></span>`;
}

export interface MountIconOptions extends RenderIconOptions {
  registry: IconRegistry<any>;
  /** HTML used while loading and when the icon cannot be resolved. Defaults to an empty same-size box. */
  fallback?: string;
}

const mountTokens = new WeakMap<Element, object>();

/**
 * Resolves `id` and replaces the content of `el` with the `<svg>`.
 * Cached icons render synchronously; if `mountIcon` is called again on the same element
 * before a previous call finished, only the latest call wins.
 */
export async function mountIcon(el: Element, id: IconId | null, options: MountIconOptions): Promise<void> {
  const token = {};
  mountTokens.set(el, token);
  const fallback = options.fallback ?? renderPlaceholder(options.size ?? 20);
  if (!id) {
    el.innerHTML = fallback;
    return;
  }
  const cached = options.registry.getCached(id);
  if (cached) {
    el.innerHTML = renderIcon(cached, options);
    return;
  }
  el.innerHTML = fallback;
  const data = await options.registry.resolve(id);
  if (mountTokens.get(el) !== token) return;
  el.innerHTML = data ? renderIcon(data, options) : fallback;
}

/** Like `mountIcon`, but takes a stored value (parsed with the registry's codec). */
export function mountIconValue<T>(
  el: Element,
  value: T | null | undefined,
  options: MountIconOptions & { registry: IconRegistry<T> },
): Promise<void> {
  return mountIcon(el, options.registry.parse(value), options);
}

const appliedAttrs = new WeakMap<Element, Set<string>>();

/**
 * Writes an attribute object from the core (`getSearchA11y()`, `getItemA11y()` …) onto an element.
 * `undefined` / `null` values — and keys that were set by a previous call but are now absent — are removed.
 */
export function applyAttrs(el: Element, attrs: A11yProps | Record<string, unknown>): void {
  const prev = appliedAttrs.get(el);
  const next = new Set<string>();
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) {
      el.removeAttribute(k);
      continue;
    }
    next.add(k);
    const s = String(v);
    if (el.getAttribute(k) !== s) el.setAttribute(k, s);
  }
  if (prev) for (const k of prev) if (!next.has(k)) el.removeAttribute(k);
  appliedAttrs.set(el, next);
}

/** `RecentsStorage` backed by `localStorage`. Failures (private mode, quota) are ignored. */
export function localStorageRecents(key = 'icon-picker:recents'): RecentsStorage {
  return {
    get() {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed.filter(v => typeof v === 'string') as IconId[]) : [];
      } catch {
        return [];
      }
    },
    set(ids) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(ids));
      } catch {
        // ignore
      }
    },
  };
}

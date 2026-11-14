import { prefixedCodec } from './codecs.js';
import type { IconData, IconId, IconMeta, IconProvider, IconRegistry, IconValueCodec } from './types.js';
import { splitIconId, toIconId } from './utils.js';

export interface IconRegistryOptions<T = string> {
  providers: IconProvider[];
  /** Defaults to `prefixedCodec()`. */
  codec?: IconValueCodec<T>;
  /** Called (once per distinct primitive value) when a stored value cannot be parsed. */
  onInvalidValue?: (value: T) => void;
  /** Called when a provider fails to load. Defaults to `console.error`. */
  onError?: (error: unknown, context: { prefix: string; operation: 'loadMeta' | 'loadIcons' }) => void;
}

// Core is DOM/Node agnostic (lib: ES2022); every JS runtime provides console.
declare const console: { error(...args: unknown[]): void };

interface Waiter {
  resolve: (data: IconData | null) => void;
}

export function createIconRegistry<T = string>(options: IconRegistryOptions<T>): IconRegistry<T> {
  const providerList = Object.freeze([...options.providers]);
  const providers = new Map<string, IconProvider>();
  for (const p of providerList) {
    if (providers.has(p.prefix)) throw new Error(`[icon-picker] duplicate provider prefix "${p.prefix}"`);
    providers.set(p.prefix, p);
  }
  const codec = (options.codec ?? prefixedCodec()) as IconValueCodec<T>;
  const onError =
    options.onError ??
    ((error, ctx) => console.error(`[icon-picker] ${ctx.prefix}.${ctx.operation} failed`, error));

  const metaCache = new Map<string, Promise<IconMeta[]>>();
  const dataCache = new Map<IconId, IconData>();
  const notFound = new Set<IconId>();
  const pending = new Map<IconId, Promise<IconData | null>>();
  let queue: Map<string, Map<string, Waiter[]>> | null = null;
  const reportedInvalid = new Set<unknown>();

  function normalize(id: string): IconId | null {
    const parts = splitIconId(id);
    if (!parts) return null;
    const provider = providers.get(parts.prefix);
    if (!provider) return null;
    const aliases = provider.aliases;
    const name =
      aliases && Object.prototype.hasOwnProperty.call(aliases, parts.name) ? aliases[parts.name]! : parts.name;
    return toIconId(parts.prefix, name);
  }

  function loadMetaFor(prefix: string): Promise<IconMeta[]> {
    let p = metaCache.get(prefix);
    if (!p) {
      const provider = providers.get(prefix);
      if (!provider) return Promise.reject(new Error(`[icon-picker] unknown provider "${prefix}"`));
      p = provider.loadMeta().catch(error => {
        metaCache.delete(prefix); // allow retry
        onError(error, { prefix, operation: 'loadMeta' });
        throw error;
      });
      metaCache.set(prefix, p);
    }
    return p;
  }

  async function flush(batch: Map<string, Map<string, Waiter[]>>): Promise<void> {
    await Promise.all(
      [...batch].map(async ([prefix, entries]) => {
        const provider = providers.get(prefix)!;
        let failed = false;
        try {
          const list = await provider.loadIcons([...entries.keys()]);
          for (const data of list) dataCache.set(toIconId(prefix, data.name), data);
        } catch (error) {
          failed = true;
          onError(error, { prefix, operation: 'loadIcons' });
        }
        for (const [name, waiters] of entries) {
          const id = toIconId(prefix, name);
          pending.delete(id);
          const data = dataCache.get(id) ?? null;
          if (!data && !failed) notFound.add(id); // failures are retried next time
          for (const w of waiters) w.resolve(data);
        }
      }),
    );
  }

  function enqueue(id: IconId): Promise<IconData | null> {
    const { prefix, name } = splitIconId(id)!;
    return new Promise(resolve => {
      if (!queue) {
        const batch = new Map<string, Map<string, Waiter[]>>();
        queue = batch;
        // Batch every resolve() issued in the same tick into one loadIcons() call per provider.
        Promise.resolve().then(() => {
          queue = null;
          return flush(batch);
        });
      }
      let entries = queue.get(prefix);
      if (!entries) queue.set(prefix, (entries = new Map()));
      let waiters = entries.get(name);
      if (!waiters) entries.set(name, (waiters = []));
      waiters.push({ resolve });
    });
  }

  function resolve(id: IconId): Promise<IconData | null> {
    const n = normalize(id);
    if (!n) return Promise.resolve(null);
    const hit = dataCache.get(n);
    if (hit) return Promise.resolve(hit);
    if (notFound.has(n)) return Promise.resolve(null);
    let p = pending.get(n);
    if (!p) {
      p = enqueue(n);
      pending.set(n, p);
    }
    return p;
  }

  return {
    getProviders: () => providerList,
    getProvider: prefix => providers.get(prefix),
    normalize,
    async loadMeta(prefix) {
      if (prefix) return loadMetaFor(prefix);
      const lists = await Promise.all(providerList.map(p => loadMetaFor(p.prefix)));
      return lists.flat();
    },
    resolve,
    async resolveMany(ids) {
      const out = new Map<IconId, IconData>();
      const results = await Promise.all(ids.map(resolve));
      ids.forEach((id, i) => {
        const data = results[i];
        if (data) out.set(id, data);
      });
      return out;
    },
    getCached(id) {
      const n = normalize(id);
      return n ? dataCache.get(n) : undefined;
    },
    parse(value) {
      if (value === null || value === undefined || (value as unknown) === '') return null;
      let id: IconId | null = null;
      try {
        id = codec.parse(value);
      } catch {
        id = null;
      }
      const n = id ? normalize(id) : null;
      if (!n) {
        const isPrimitive = typeof value !== 'object';
        if (!isPrimitive || !reportedInvalid.has(value)) {
          if (isPrimitive) reportedInvalid.add(value);
          options.onInvalidValue?.(value);
        }
      }
      return n;
    },
    format(id) {
      const n = normalize(id);
      if (!n) throw new Error(`[icon-picker] cannot format unknown icon id "${id}"`);
      return codec.format(n);
    },
  };
}

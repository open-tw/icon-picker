import type { IconData, IconId, IconMeta, IconProvider } from '@open-tw/icon-picker-core';
import aliases from '../generated/aliases.js';
import categoryLabels from '../generated/categories.js';

export { version as LUCIDE_VERSION, count as LUCIDE_ICON_COUNT } from '../generated/info.js';

const PREFIX = 'lucide';

let metaPromise: Promise<IconMeta[]> | null = null;
let metaIndex: Map<string, IconMeta> | null = null;
let bodiesPromise: Promise<Readonly<Record<string, string>>> | null = null;

/** Lazily imported so the data never lands in the main bundle. */
function loadMetaOnce(): Promise<IconMeta[]> {
  metaPromise ??= import('../generated/meta.js').then(
    ({ default: rows }) => {
      const list = rows.map(
        ([name, tags, categories]): IconMeta => ({ id: `${PREFIX}:${name}` as IconId, name, tags, categories }),
      );
      metaIndex = new Map(list.map(m => [m.name, m]));
      return list;
    },
    error => {
      metaPromise = null;
      throw error;
    },
  );
  return metaPromise;
}

function loadBodiesOnce(): Promise<Readonly<Record<string, string>>> {
  bodiesPromise ??= import('../generated/bodies.js').then(
    m => m.default,
    error => {
      bodiesPromise = null;
      throw error;
    },
  );
  return bodiesPromise;
}

export const lucide: IconProvider = {
  prefix: PREFIX,
  label: 'Lucide',
  aliases,
  categoryLabels,
  loadMeta: () => loadMetaOnce().then(list => list.slice()),
  async loadIcons(names) {
    const [, bodies] = await Promise.all([loadMetaOnce(), loadBodiesOnce()]);
    const out: IconData[] = [];
    for (const raw of names) {
      const name = Object.prototype.hasOwnProperty.call(aliases, raw) ? aliases[raw]! : raw;
      const meta = metaIndex!.get(name);
      const body = Object.prototype.hasOwnProperty.call(bodies, name) ? bodies[name] : undefined;
      if (!meta || body === undefined) continue;
      // Lucide: always stroke icons on a 24×24 grid.
      out.push({ ...meta, body, width: 24, height: 24, style: 'stroke' });
    }
    return out;
  },
};

export default lucide;

import type { IconMeta, SearchField } from './types.js';

const Rank = { Exact: 0, Prefix: 1, Contains: 2, None: 3 } as const;
type Rank = (typeof Rank)[keyof typeof Rank];

interface SearchEntry {
  name: string;
  /** name with separators turned into spaces, so "chart bar" matches `chart-bar`. */
  spacedName: string;
  label: string;
  tags: string[];
}

const entries = new WeakMap<IconMeta, SearchEntry>();

function entryOf(icon: IconMeta): SearchEntry {
  let e = entries.get(icon);
  if (!e) {
    const name = icon.name.toLowerCase();
    e = {
      name,
      spacedName: name.replace(/[-_]+/g, ' '),
      label: (icon.label ?? '').toLowerCase(),
      tags: icon.tags.map(t => t.toLowerCase()),
    };
    entries.set(icon, e);
  }
  return e;
}

function rankText(text: string, q: string): Rank {
  if (!text) return Rank.None;
  if (text === q) return Rank.Exact;
  if (text.startsWith(q)) return Rank.Prefix;
  if (text.includes(q)) return Rank.Contains;
  return Rank.None;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const DEFAULT_SEARCH_FIELDS: readonly SearchField[] = ['name', 'tags', 'label'];

/**
 * Case-insensitive match on name, tags and label.
 * Ordered by exact → prefix → contains; ties keep field priority (name > label > tags) then input order.
 */
export function searchIcons(
  icons: readonly IconMeta[],
  query: string,
  fields: readonly SearchField[] = DEFAULT_SEARCH_FIELDS,
): IconMeta[] {
  const q = normalizeQuery(query);
  if (!q) return icons.slice();
  const dashed = q.replace(/ /g, '-');
  const useName = fields.includes('name');
  const useLabel = fields.includes('label');
  const useTags = fields.includes('tags');

  const scored: { icon: IconMeta; score: number; index: number }[] = [];
  icons.forEach((icon, index) => {
    const e = entryOf(icon);
    let best = Rank.None * 3 + 2;
    const consider = (rank: Rank, fieldPriority: number) => {
      if (rank === Rank.None) return;
      const score = rank * 3 + fieldPriority;
      if (score < best) best = score;
    };
    if (useName) {
      consider(Math.min(rankText(e.name, dashed), rankText(e.spacedName, q)) as Rank, 0);
    }
    if (useLabel) consider(rankText(e.label, q), 1);
    if (useTags) {
      for (const tag of e.tags) {
        consider(rankText(tag, q), 2);
        if (best === Rank.Exact * 3 + 2) break;
      }
    }
    if (best < Rank.None * 3) scored.push({ icon, score: best, index });
  });
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.map(s => s.icon);
}

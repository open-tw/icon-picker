import { vi } from 'vitest';
import type { IconData, IconId, IconMeta, IconProvider } from '../src/index.js';

export const NAMES = [
  'chart-bar',
  'chart-line',
  'chart-pie',
  'bar-code',
  'user',
  'users',
  'house',
  'settings',
  'star',
  'heart',
  'image',
] as const;

const CATEGORIES: Record<string, string[]> = {
  'chart-bar': ['charts'],
  'chart-line': ['charts'],
  'chart-pie': ['charts'],
  user: ['people'],
  users: ['people'],
  house: ['home'],
};

const TAGS: Record<string, string[]> = {
  'chart-bar': ['graph', 'statistics'],
  'chart-line': ['graph', 'trend'],
  house: ['home', 'building'],
  heart: ['love', 'like'],
  star: ['favorite', 'bar'],
};

export function makeMeta(prefix = 'test'): IconMeta[] {
  return NAMES.map(name => ({
    id: `${prefix}:${name}` as IconId,
    name,
    tags: TAGS[name] ?? [],
    categories: CATEGORIES[name] ?? [],
  }));
}

export function makeProvider(prefix = 'test') {
  const meta = makeMeta(prefix);
  const provider = {
    prefix,
    label: prefix.toUpperCase(),
    aliases: { home: 'house' },
    categoryLabels: { charts: 'Charts', people: 'People', home: 'Home' },
    loadMeta: vi.fn(async () => meta),
    loadIcons: vi.fn(async (names: string[]): Promise<IconData[]> =>
      meta
        .filter(m => names.includes(m.name))
        .map(m => ({ ...m, body: `<path d="${m.name}"/>`, width: 24, height: 24, style: 'stroke' as const })),
    ),
  } satisfies IconProvider;
  return provider;
}

export const flush = () => new Promise(r => setTimeout(r, 0));

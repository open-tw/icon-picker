import {
  createIconRegistry,
  type IconData,
  type IconId,
  type IconMeta,
  type IconProvider,
  type IconRegistryOptions,
} from '@open-tw/icon-picker-core';
import { vi } from 'vitest';

const NAMES = ['chart-bar', 'chart-line', 'user', 'users', 'house', 'star', 'heart', 'image'];

export function makeRegistry(options: Partial<IconRegistryOptions<string>> = {}) {
  const meta: IconMeta[] = NAMES.map(name => ({
    id: `t:${name}` as IconId,
    name,
    tags: name === 'house' ? ['home'] : [],
    categories: name.startsWith('chart') ? ['charts'] : [],
  }));
  const provider = {
    prefix: 't',
    label: 'T',
    loadMeta: vi.fn(async () => meta),
    loadIcons: vi.fn(async (names: string[]): Promise<IconData[]> =>
      meta
        .filter(m => names.includes(m.name))
        .map(m => ({ ...m, body: `<path d="${m.name}"></path>`, width: 24, height: 24, style: 'stroke' as const })),
    ),
  } satisfies IconProvider;
  const registry = createIconRegistry<string>({ providers: [provider], ...options });
  return { registry, provider };
}

import { createIconPicker, createIconRegistry, pascalCodec } from '@open-tw/icon-picker-core';
import { describe, expect, it } from 'vitest';
import { lucideComponentNames } from '../src/component-names.js';
import { LUCIDE_ICON_COUNT, lucide } from '../src/index.js';

describe('lucide provider (generated data)', () => {
  it('exposes metadata with tags and categories', async () => {
    const meta = await lucide.loadMeta();
    expect(meta).toHaveLength(LUCIDE_ICON_COUNT);
    expect(meta.length).toBeGreaterThan(1500);
    const chartBar = meta.find(m => m.name === 'chart-bar')!;
    expect(chartBar.id).toBe('lucide:chart-bar');
    expect(chartBar.tags.length).toBeGreaterThan(0);
    expect(chartBar.categories).toContain('charts');
    expect(meta.every(m => m.categories.every(c => !c.startsWith('$')))).toBe(true);
    expect(lucide.categoryLabels?.charts).toBe('Charts');
  });

  it('loads inner SVG bodies only (outer attributes come from the renderer)', async () => {
    const [icon] = await lucide.loadIcons(['chart-bar']);
    expect(icon).toMatchObject({ id: 'lucide:chart-bar', width: 24, height: 24, style: 'stroke' });
    expect(icon!.body).toMatch(/^<path d="/);
    expect(icon!.body).not.toContain('<svg');
    expect(icon!.body).not.toContain('stroke-width');
  });

  it('resolves renamed icons through aliases', async () => {
    const registry = createIconRegistry({ providers: [lucide] });
    expect(lucide.aliases?.['bar-chart-horizontal']).toBe('chart-bar');
    expect((await registry.resolve('lucide:bar-chart-horizontal'))?.name).toBe('chart-bar');
  });

  it('component name table handles digits, suffixes and old names', () => {
    const registry = createIconRegistry({
      providers: [lucide],
      codec: pascalCodec({ prefix: 'lucide', names: lucideComponentNames }),
    });
    expect(registry.parse('ArrowUp10')).toBe('lucide:arrow-up-1-0');
    expect(registry.parse('ChartBarIcon')).toBe('lucide:chart-bar');
    expect(registry.parse('LucideChartBar')).toBe('lucide:chart-bar');
    expect(registry.parse('BarChartHorizontal')).toBe('lucide:chart-bar');
    expect(registry.format('lucide:arrow-up-1-0')).toBe('ArrowUp10');
    // Every canonical name round-trips through the codec.
    for (const name of new Set(Object.values(lucideComponentNames))) {
      expect(registry.parse(registry.format(`lucide:${name}`))).toBe(`lucide:${name}`);
    }
  });

  it('works end-to-end with the picker', async () => {
    const registry = createIconRegistry({ providers: [lucide] });
    let saved: string | null = null;
    const picker = createIconPicker({ registry, columns: 8, onChange: v => (saved = v) });
    picker.open();
    await picker.load();
    picker.setQuery('chart bar');
    expect(picker.getFilteredIcons()[0]?.id).toBe('lucide:chart-bar');
    picker.handleKeyDown({ key: 'Enter' });
    expect(saved).toBe('lucide:chart-bar');
  });
});

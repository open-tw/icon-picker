// @vitest-environment happy-dom
import { createIconRegistry, type IconData, type IconProvider } from '@open-tw/icon-picker-core';
import { describe, expect, it, vi } from 'vitest';
import { applyAttrs, localStorageRecents, mountIcon, mountIconValue, renderIcon } from '../src/index.js';

const icon = (name: string, style: 'stroke' | 'fill' = 'stroke'): IconData => ({
  id: `t:${name}`,
  name,
  tags: [],
  categories: [],
  body: `<path d="${name}"/>`,
  width: 24,
  height: 24,
  style,
});

function makeRegistry(delay = 0) {
  const loadIcons = vi.fn(
    (names: string[]) => new Promise<IconData[]>(r => setTimeout(() => r(names.filter(n => n !== 'missing').map(n => icon(n))), delay)),
  );
  const provider: IconProvider = { prefix: 't', label: 'T', loadMeta: async () => [], loadIcons };
  return { registry: createIconRegistry({ providers: [provider] }), loadIcons };
}

describe('renderIcon', () => {
  it('renders stroke icons with controllable stroke width', () => {
    const svg = renderIcon(icon('a'), { size: 16, strokeWidth: 1.5 });
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
        'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true" data-icon="t:a">' +
        '<path d="a"/></svg>',
    );
  });

  it('renders fill icons and accessible titles with escaping', () => {
    const svg = renderIcon(icon('b', 'fill'), { title: 'A "quoted" <title>', attrs: { class: 'x', 'bad attr': 'y' } });
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toContain('stroke-width');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="A &quot;quoted&quot; &lt;title&gt;"');
    expect(svg).not.toContain('aria-hidden');
    expect(svg).toContain('class="x"');
    expect(svg).not.toContain('bad attr');
  });
});

describe('mountIcon', () => {
  it('shows a placeholder, then the svg', async () => {
    const { registry } = makeRegistry();
    const el = document.createElement('span');
    const p = mountIcon(el, 't:a', { registry });
    expect(el.querySelector('[data-icon-placeholder]')).not.toBeNull();
    await p;
    expect(el.querySelector('svg')?.getAttribute('data-icon')).toBe('t:a');
  });

  it('renders cached icons synchronously', async () => {
    const { registry } = makeRegistry();
    await registry.resolve('t:a');
    const el = document.createElement('span');
    void mountIcon(el, 't:a', { registry });
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('latest call wins when mounting into the same element', async () => {
    const { registry } = makeRegistry(5);
    const el = document.createElement('span');
    const first = mountIcon(el, 't:a', { registry });
    const second = mountIcon(el, 't:b', { registry });
    await Promise.all([first, second]);
    expect(el.querySelector('svg')?.getAttribute('data-icon')).toBe('t:b');
  });

  it('falls back for missing icons and null ids', async () => {
    const { registry } = makeRegistry();
    const el = document.createElement('span');
    await mountIcon(el, 't:missing', { registry, fallback: '<i>?</i>' });
    expect(el.innerHTML).toBe('<i>?</i>');
    await mountIcon(el, null, { registry, fallback: '<i>-</i>' });
    expect(el.innerHTML).toBe('<i>-</i>');
  });

  it('mountIconValue parses stored values', async () => {
    const { registry } = makeRegistry();
    const el = document.createElement('span');
    await mountIconValue(el, 't:a', { registry });
    expect(el.querySelector('svg')).not.toBeNull();
  });
});

describe('applyAttrs', () => {
  it('sets, stringifies and removes stale attributes', () => {
    const el = document.createElement('input');
    applyAttrs(el, { role: 'combobox', 'aria-expanded': true, 'aria-activedescendant': 'x' });
    expect(el.getAttribute('aria-expanded')).toBe('true');
    expect(el.getAttribute('aria-activedescendant')).toBe('x');
    applyAttrs(el, { role: 'combobox', 'aria-expanded': false, 'aria-activedescendant': undefined });
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(el.hasAttribute('aria-activedescendant')).toBe(false);
    applyAttrs(el, { role: 'combobox' });
    expect(el.hasAttribute('aria-expanded')).toBe(false);
  });
});

describe('localStorageRecents', () => {
  it('round-trips and tolerates corrupt data', () => {
    const s = localStorageRecents('k');
    s.set(['t:a', 't:b']);
    expect(s.get()).toEqual(['t:a', 't:b']);
    localStorage.setItem('k', '{not json');
    expect(s.get()).toEqual([]);
  });
});

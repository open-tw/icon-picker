import { describe, expect, it, vi } from 'vitest';
import {
  createIconPicker,
  createIconRegistry,
  pascalCodec,
  searchIcons,
  type IconPickerOptions,
  type IconPickerState,
  type RecentsStorage,
} from '../src/index.js';
import { flush, makeMeta, makeProvider } from './fixtures.js';

function setup(extra: Partial<IconPickerOptions> = {}) {
  const provider = makeProvider();
  const registry = createIconRegistry({ providers: [provider] });
  const onChange = vi.fn();
  const picker = createIconPicker({ registry, columns: 3, onChange, ...extra });
  return { picker, registry, provider, onChange };
}

async function opened(extra: Partial<IconPickerOptions> = {}) {
  const ctx = setup(extra);
  ctx.picker.mount();
  ctx.picker.open();
  await ctx.picker.load();
  return ctx;
}

const names = (icons: { name: string }[]) => icons.map(i => i.name);

describe('search', () => {
  it('orders exact → prefix → contains, name before tags', () => {
    const meta = makeMeta();
    expect(names(searchIcons(meta, 'user'))).toEqual(['user', 'users']);
    // "bar": star (exact tag) > bar-code (name prefix) > chart-bar (name contains)
    expect(names(searchIcons(meta, 'bar'))).toEqual(['star', 'bar-code', 'chart-bar']);
    expect(names(searchIcons(meta, 'CHART BAR'))).toEqual(['chart-bar']);
    expect(names(searchIcons(meta, 'graph'))).toEqual(['chart-bar', 'chart-line']);
    expect(names(searchIcons(meta, 'graph', ['name']))).toEqual([]);
  });
});

describe('state', () => {
  it('getState() keeps its reference until something changes', () => {
    const { picker } = setup();
    const a = picker.getState();
    expect(picker.getState()).toBe(a);
    picker.setQuery('x');
    expect(picker.getState()).not.toBe(a);
    expect(picker.getState()).toBe(picker.getState());
  });

  it('setOptions() never notifies', () => {
    const { picker } = setup();
    const listener = vi.fn();
    picker.subscribe(listener);
    picker.setOptions(o => ({ ...o, columns: 5, value: 'test:user' }));
    expect(listener).not.toHaveBeenCalled();
    picker.setQuery('a');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('supports partially controlled state', () => {
    let controlled: Partial<IconPickerState> = { query: 'from-url' };
    const onStateChange = vi.fn();
    const { picker } = setup({ state: controlled, onStateChange });
    expect(picker.getState().query).toBe('from-url');

    picker.setQuery('typed');
    // Controlled slice is unchanged until the owner feeds it back…
    expect(picker.getState().query).toBe('from-url');
    expect(onStateChange).toHaveBeenCalledOnce();
    const next = onStateChange.mock.calls[0]![0] as IconPickerState;
    expect(next.query).toBe('typed');

    controlled = { query: next.query };
    picker.setOptions(o => ({ ...o, state: controlled }));
    expect(picker.getState().query).toBe('typed');

    // …while uncontrolled slices are stored internally.
    picker.setCategory('charts');
    expect(picker.getState().category).toBe('charts');
  });

  it('honours initialState', () => {
    const { picker } = setup({ initialState: { query: 'star', category: 'charts' } });
    expect(picker.getState()).toMatchObject({ query: 'star', category: 'charts', open: false });
  });
});

describe('loading & derived data', () => {
  it('lazy-loads on first open and exposes rows / categories', async () => {
    const { picker, provider } = setup();
    expect(provider.loadMeta).not.toHaveBeenCalled();
    picker.open();
    expect(picker.getState().status).toBe('loading');
    expect(picker.getAnnouncement()).toBe('Loading icons…');
    await flush();
    expect(picker.getState().status).toBe('ready');
    expect(picker.getFilteredIcons()).toHaveLength(11);
    expect(picker.getRows().map(r => r.length)).toEqual([3, 3, 3, 2]);
    expect(picker.getCategories()).toEqual([
      { id: 'charts', label: 'Charts', count: 3 },
      { id: 'home', label: 'Home', count: 1 },
      { id: 'people', label: 'People', count: 2 },
    ]);
    expect(picker.getAnnouncement()).toBe('11 icons found');
  });

  it('memoises derived data', async () => {
    const { picker } = await opened();
    expect(picker.getFilteredIcons()).toBe(picker.getFilteredIcons());
    expect(picker.getRows()).toBe(picker.getRows());
    picker.setActiveIndex(2);
    expect(picker.getRows()).toBe(picker.getRows());
  });

  it('filters by category, query and the filter option', async () => {
    const { picker } = await opened({ filter: icon => icon.name !== 'chart-pie' });
    picker.setCategory('charts');
    expect(names(picker.getFilteredIcons())).toEqual(['chart-bar', 'chart-line']);
    picker.setQuery('line');
    expect(names(picker.getFilteredIcons())).toEqual(['chart-line']);
    picker.setCategory(null);
    picker.setQuery('zzz');
    expect(picker.getAnnouncement()).toBe('No icons found');
  });

  it('respects disabled features', async () => {
    const { picker } = await opened({ features: { search: false, categories: false } });
    picker.setQuery('user');
    picker.setCategory('charts');
    expect(picker.getState()).toMatchObject({ query: '', category: null });
    expect(picker.getCategories()).toEqual([]);
  });

  it('reports load errors', async () => {
    const provider = makeProvider();
    provider.loadMeta.mockRejectedValueOnce(new Error('boom'));
    const registry = createIconRegistry({ providers: [provider], onError: () => {} });
    const picker = createIconPicker({ registry });
    picker.open();
    await flush();
    expect(picker.getState().status).toBe('error');
    expect(picker.getAnnouncement()).toBe('Failed to load icons');
    await picker.load();
    expect(picker.getState().status).toBe('ready');
  });
});

describe('selection', () => {
  it('select() emits the stored format, closes, and records recents', async () => {
    const storage: RecentsStorage = { get: () => [], set: vi.fn() };
    const { picker, onChange } = await opened({ features: { recents: { storage, max: 2 } } });
    picker.select('test:user');
    expect(onChange).toHaveBeenCalledWith('test:user');
    expect(picker.getState().open).toBe(false);
    expect(picker.getValue()).toBe('test:user'); // uncontrolled
    picker.select('test:home'); // alias → canonical
    picker.select('test:star');
    expect(picker.getState().recents).toEqual(['test:star', 'test:house']);
    expect(storage.set).toHaveBeenLastCalledWith(['test:star', 'test:house']);
    expect(names(picker.getRecentIcons())).toEqual(['star', 'house']);
  });

  it('loads recents from storage on mount', async () => {
    const storage: RecentsStorage = { get: async () => ['test:heart'], set: () => {} };
    const { picker } = setup({ features: { recents: { storage } } });
    picker.mount();
    await flush();
    expect(picker.getState().recents).toEqual(['test:heart']);
  });

  it('uses the registry codec for value in / out', async () => {
    const provider = makeProvider();
    const onInvalidValue = vi.fn();
    const registry = createIconRegistry({
      providers: [provider],
      codec: pascalCodec({ prefix: 'test', names: { User: 'user', ChartBar: 'chart-bar' } }),
      onInvalidValue,
    });
    const onChange = vi.fn();
    const picker = createIconPicker({ registry, value: 'ChartBar', onChange, columns: 3 });
    expect(picker.getSelectedId()).toBe('test:chart-bar');
    picker.open();
    await flush();
    expect(picker.getSelectedIcon()?.name).toBe('chart-bar');
    // Opening focuses the selected icon.
    expect(picker.getActiveIcon()?.name).toBe('chart-bar');
    picker.select('test:user');
    expect(onChange).toHaveBeenCalledWith('User');
    // Controlled: value only changes when the owner passes it back.
    expect(picker.getSelectedId()).toBe('test:chart-bar');

    picker.setOptions(o => ({ ...o, value: 'Garbage' }));
    expect(picker.getSelectedId()).toBeNull();
    expect(onInvalidValue).toHaveBeenCalledWith('Garbage');
  });

  it('clear() emits null', async () => {
    const { picker, onChange } = setup({ defaultValue: 'test:user' });
    expect(picker.getSelectedId()).toBe('test:user');
    picker.clear();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(picker.getSelectedId()).toBeNull();
  });
});

describe('keyboard', () => {
  const key = (k: string, extra: object = {}) => ({ key: k, preventDefault: vi.fn(), ...extra });

  it('navigates the grid in two dimensions', async () => {
    // 11 icons, 3 columns → rows: [0 1 2] [3 4 5] [6 7 8] [9 10]
    const { picker } = await opened({ pageSize: 2 });
    const at = () => picker.getState().activeIndex;
    picker.handleKeyDown(key('ArrowRight'));
    expect(at()).toBe(1);
    picker.handleKeyDown(key('ArrowDown'));
    expect(at()).toBe(4);
    picker.handleKeyDown(key('End'));
    expect(at()).toBe(5);
    picker.handleKeyDown(key('Home'));
    expect(at()).toBe(3);
    picker.handleKeyDown(key('ArrowUp'));
    expect(at()).toBe(0);
    picker.handleKeyDown(key('ArrowUp'));
    expect(at()).toBe(0);
    picker.handleKeyDown(key('ArrowLeft'));
    expect(at()).toBe(0);
    picker.handleKeyDown(key('End', { ctrlKey: true }));
    expect(at()).toBe(10);
    picker.handleKeyDown(key('Home', { metaKey: true }));
    expect(at()).toBe(0);
    picker.handleKeyDown(key('PageDown'));
    expect(at()).toBe(6);
    picker.handleKeyDown(key('PageDown'));
    expect(at()).toBe(9);
    picker.handleKeyDown(key('PageUp'));
    expect(at()).toBe(3);
    picker.setActiveIndex(8);
    picker.handleKeyDown(key('ArrowDown')); // shorter last row → last item
    expect(at()).toBe(10);
    picker.handleKeyDown(key('ArrowDown'));
    expect(at()).toBe(10);
  });

  it('Enter selects, Escape clears the query then closes', async () => {
    const { picker, onChange } = await opened();
    picker.setQuery('user');
    picker.handleKeyDown(key('ArrowRight'));
    const esc = key('Escape');
    expect(picker.handleKeyDown(esc)).toBe(true);
    expect(esc.preventDefault).toHaveBeenCalled();
    expect(picker.getState()).toMatchObject({ query: '', open: true });
    picker.handleKeyDown(key('Escape'));
    expect(picker.getState().open).toBe(false);

    picker.open();
    picker.setQuery('users');
    picker.handleKeyDown(key('Enter'));
    expect(onChange).toHaveBeenCalledWith('test:users');
  });

  it('does not intercept Tab, unrelated keys, or IME composition', async () => {
    const { picker, onChange } = await opened();
    const tab = key('Tab');
    expect(picker.handleKeyDown(tab)).toBe(false);
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(picker.handleKeyDown(key('a'))).toBe(false);
    expect(picker.handleKeyDown(key('Enter', { isComposing: true }))).toBe(false);
    expect(picker.handleKeyDown(key('Enter', { nativeEvent: { isComposing: true } }))).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ArrowDown opens a closed picker', () => {
    const { picker } = setup();
    expect(picker.handleKeyDown(key('ArrowDown'))).toBe(true);
    expect(picker.getState().open).toBe(true);
  });
});

describe('a11y', () => {
  it('returns plain attribute objects', async () => {
    const { picker } = await opened({ id: 'ip', defaultValue: 'test:chart-line' });
    const grid = picker.getGridA11y();
    expect(grid).toEqual({ role: 'listbox', id: 'ip-listbox', 'aria-label': 'Icons' });

    picker.setActiveIndex(0);
    const active = picker.getActiveIcon()!;
    expect(picker.getSearchA11y()).toEqual({
      role: 'combobox',
      'aria-expanded': true,
      'aria-controls': 'ip-listbox',
      'aria-autocomplete': 'list',
      'aria-label': 'Search icons',
      'aria-activedescendant': 'ip-option-test-chart-bar',
    });
    expect(picker.getItemA11y(active)).toMatchObject({
      role: 'option',
      id: 'ip-option-test-chart-bar',
      'aria-selected': true,
      'aria-label': 'Chart bar',
      'data-active': 'true',
      'data-current': undefined,
    });
    const current = picker.getFilteredIcons()[1]!;
    expect(picker.getItemA11y(current)).toMatchObject({ 'aria-selected': false, 'data-current': 'true' });

    picker.close();
    expect(picker.getSearchA11y()['aria-activedescendant']).toBeUndefined();
  });

  it('localises messages', async () => {
    const { picker } = await opened({ messages: { results: n => `找到 ${n} 個 icon` } });
    expect(picker.getAnnouncement()).toBe('找到 11 個 icon');
  });
});

describe('lifecycle', () => {
  it('mount() is re-entrant (StrictMode) and cleanups are idempotent', async () => {
    const storage: RecentsStorage = { get: vi.fn(() => []), set: () => {} };
    const { picker } = setup({ features: { recents: { storage } } });
    const c1 = picker.mount();
    c1();
    c1();
    const c2 = picker.mount();
    c2();
    expect(storage.get).toHaveBeenCalledTimes(1);
  });
});

import { defaultMessages } from './messages.js';
import { DEFAULT_SEARCH_FIELDS, searchIcons } from './search.js';
import type {
  A11yProps,
  CategoryItem,
  IconId,
  IconMeta,
  IconPicker,
  IconPickerMessages,
  IconPickerOptions,
  IconPickerState,
  KeyboardEventLike,
  MoveDirection,
  RecentsStorage,
  SearchField,
  Updater,
} from './types.js';
import { clamp, functionalUpdate, memo, shallowEqual } from './utils.js';

export const defaultState: IconPickerState = Object.freeze({
  open: false,
  query: '',
  category: null,
  provider: null,
  activeIndex: 0,
  recents: [],
  status: 'idle',
}) as IconPickerState;

const DEFAULT_RECENTS_MAX = 24;
const DEFAULT_PAGE_SIZE = 5;

let idCounter = 0;

interface ResolvedFeatures {
  search: false | { fields: readonly SearchField[] };
  categories: boolean;
  recents: false | { max: number; storage: RecentsStorage | undefined };
}

function resolveFeatures(f: IconPickerOptions<unknown>['features']): ResolvedFeatures {
  const search = f?.search ?? true;
  const recents = f?.recents ?? false;
  return {
    search:
      search === false
        ? false
        : { fields: typeof search === 'object' && search.fields?.length ? search.fields : DEFAULT_SEARCH_FIELDS },
    categories: f?.categories ?? true,
    recents:
      recents === false
        ? false
        : {
            max: (typeof recents === 'object' && recents.max) || DEFAULT_RECENTS_MAX,
            storage: typeof recents === 'object' ? recents.storage : undefined,
          },
  };
}

function cssSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function createIconPicker<T = string>(initialOptions: IconPickerOptions<T>): IconPicker<T> {
  let options = initialOptions;
  let internal: IconPickerState = { ...defaultState, ...initialOptions.initialState };
  let uncontrolledValue: T | null = initialOptions.defaultValue ?? null;
  const listeners = new Set<() => void>();
  const baseId = cssSafe(initialOptions.id ?? `icon-picker-${++idCounter}`);
  const listboxId = `${baseId}-listbox`;

  // Loaded metadata, per provider prefix.
  const metaByProvider = new Map<string, IconMeta[]>();
  let metaVersion = 0;
  let loading: Promise<void> | null = null;
  let loadingKey: string | null = null;
  let mountCount = 0;
  let recentsLoaded = false;

  const registry = () => options.registry;
  const features: () => ResolvedFeatures = memo(() => [options.features] as const, f => resolveFeatures(f as IconPickerOptions<unknown>['features']));
  const messages: () => IconPickerMessages = memo(
    () => [options.messages] as const,
    (m): IconPickerMessages => ({ ...defaultMessages, ...m }),
  );

  // ---------------------------------------------------------------- state

  let mergedCache: { internal: IconPickerState; controlled: Partial<IconPickerState>; merged: IconPickerState } | null =
    null;

  /** Returns the same reference while nothing changed (required by useSyncExternalStore). */
  function getState(): IconPickerState {
    const controlled = options.state;
    if (!controlled || Object.keys(controlled).length === 0) return internal;
    if (mergedCache && mergedCache.internal === internal && shallowEqual(mergedCache.controlled, controlled)) {
      return mergedCache.merged;
    }
    const merged = { ...internal };
    for (const key of Object.keys(controlled) as (keyof IconPickerState)[]) {
      if (controlled[key] !== undefined) (merged as unknown as Record<string, unknown>)[key] = controlled[key];
    }
    mergedCache = { internal, controlled: { ...controlled }, merged };
    return merged;
  }

  function notify() {
    for (const l of [...listeners]) l();
  }

  function commit(updater: Updater<IconPickerState>): boolean {
    const prev = getState();
    const next = functionalUpdate(updater, prev);
    if (next === prev || shallowEqual(next, prev)) return false;
    const controlled = options.state ?? {};
    let nextInternal: IconPickerState | null = null;
    for (const key of Object.keys(next) as (keyof IconPickerState)[]) {
      if (controlled[key] !== undefined) continue;
      if (!Object.is(internal[key], next[key])) {
        nextInternal ??= { ...internal };
        (nextInternal as unknown as Record<string, unknown>)[key] = next[key];
      }
    }
    if (nextInternal) internal = nextInternal;
    options.onStateChange?.(next);
    return true;
  }

  function setState(updater: Updater<IconPickerState>) {
    if (commit(updater)) notify();
  }

  function patch(partial: Partial<IconPickerState>) {
    setState(s => ({ ...s, ...partial }));
  }

  // ---------------------------------------------------------------- value

  function getValue(): T | null {
    return options.value !== undefined ? options.value : uncontrolledValue;
  }

  const getSelectedId: () => IconId | null = memo(
    () => [getValue(), options.registry] as const,
    (value, reg) => (value === null || value === undefined ? null : reg.parse(value)),
  );

  // ---------------------------------------------------------------- derived

  const getAllIcons: () => IconMeta[] = memo(
    () => [getState().provider, metaVersion, options.filter] as const,
    (provider, _v, filter) => {
      const prefixes = provider ? [provider] : registry().getProviders().map(p => p.prefix);
      const list = prefixes.flatMap(p => metaByProvider.get(p) ?? []);
      return filter ? list.filter(filter) : list;
    },
  );

  const getMetaIndex: () => Map<IconId, IconMeta> = memo(
    () => [metaVersion] as const,
    _version => {
      const index = new Map<IconId, IconMeta>();
      for (const list of metaByProvider.values()) for (const icon of list) index.set(icon.id, icon);
      return index;
    },
  );

  const getCategories: () => CategoryItem[] = memo(
    () => [getAllIcons(), features().categories] as const,
    (icons, enabled): CategoryItem[] => {
      if (!enabled) return [];
      const counts = new Map<string, number>();
      const labels = new Map<string, string>();
      for (const icon of icons) {
        const labelMap = registry().getProvider(icon.id.slice(0, icon.id.indexOf(':')))?.categoryLabels;
        for (const c of icon.categories) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
          if (!labels.has(c)) labels.set(c, labelMap?.[c] ?? c);
        }
      }
      return [...counts]
        .map(([id, count]) => ({ id, label: labels.get(id) ?? id, count }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  );

  const getFilteredIcons: () => IconMeta[] = memo(
    () => {
      const s = getState();
      const f = features();
      return [
        getAllIcons(),
        f.categories ? s.category : null,
        f.search ? s.query : '',
        f.search ? f.search.fields.join(',') : '',
      ] as const;
    },
    (icons, category, query, fields) => {
      let list = category ? icons.filter(i => i.categories.includes(category)) : icons;
      if (query.trim()) list = searchIcons(list, query, fields.split(',') as SearchField[]);
      return list;
    },
  );

  const getRows: () => IconMeta[][] = memo(
    () => [getFilteredIcons(), Math.max(1, Math.floor(options.columns ?? 1))] as const,
    (icons, columns) => {
      const rows: IconMeta[][] = [];
      for (let i = 0; i < icons.length; i += columns) rows.push(icons.slice(i, i + columns));
      return rows;
    },
  );

  const getRecentIcons: () => IconMeta[] = memo(
    () => [getState().recents, getMetaIndex(), options.filter, features().recents !== false] as const,
    (recents, index, filter, enabled) => {
      if (!enabled) return [];
      const out: IconMeta[] = [];
      for (const id of recents) {
        const n = registry().normalize(id);
        const icon = n ? index.get(n) : undefined;
        if (icon && (!filter || filter(icon))) out.push(icon);
      }
      return out;
    },
  );

  function getActiveIcon(): IconMeta | null {
    const icons = getFilteredIcons();
    return icons[getState().activeIndex] ?? null;
  }

  function getSelectedIcon(): IconMeta | null {
    const id = getSelectedId();
    return id ? (getMetaIndex().get(id) ?? null) : null;
  }

  // ---------------------------------------------------------------- loading

  function load(): Promise<void> {
    const provider = getState().provider;
    const prefixes = provider ? [provider] : registry().getProviders().map(p => p.prefix);
    const missing = prefixes.filter(p => !metaByProvider.has(p));
    if (missing.length === 0) {
      if (getState().status !== 'ready') patch({ status: 'ready' });
      return Promise.resolve();
    }
    const key = missing.join(',');
    if (loading && loadingKey === key) return loading;

    patch({ status: 'loading' });
    loadingKey = key;
    const promise: Promise<void> = Promise.all(
      missing.map(async prefix => {
        const list = await registry().loadMeta(prefix);
        metaByProvider.set(prefix, list);
        metaVersion++;
      }),
    ).then(
      () => {
        if (loading !== promise) return;
        loading = loadingKey = null;
        setState(s => ({ ...s, status: 'ready', activeIndex: initialActiveIndex(s) }));
      },
      () => {
        if (loading !== promise) return;
        loading = loadingKey = null;
        patch({ status: 'error' });
      },
    );
    loading = promise;
    return promise;
  }

  function initialActiveIndex(s: IconPickerState): number {
    if (!s.open) return s.activeIndex;
    const selected = getSelectedId();
    const index = selected ? getFilteredIcons().findIndex(i => i.id === selected) : -1;
    return index >= 0 ? index : clamp(s.activeIndex, 0, Math.max(0, getFilteredIcons().length - 1));
  }

  async function loadRecents() {
    const f = features().recents;
    if (recentsLoaded || !f || !f.storage) return;
    recentsLoaded = true;
    try {
      const stored = await f.storage.get();
      if (!Array.isArray(stored) || stored.length === 0) return;
      setState(s => {
        const merged = [...s.recents, ...stored.filter(id => !s.recents.includes(id))].slice(0, f.max);
        return { ...s, recents: merged };
      });
    } catch {
      // Storage failures should never break the picker.
    }
  }

  function pushRecent(id: IconId) {
    const f = features().recents;
    if (!f) return null;
    const recents = [id, ...getState().recents.filter(r => r !== id)].slice(0, f.max);
    return recents;
  }

  // ---------------------------------------------------------------- actions

  function setQuery(query: string) {
    if (!features().search) return;
    patch({ query, activeIndex: 0 });
  }

  function setCategory(category: string | null) {
    if (!features().categories) return;
    patch({ category, activeIndex: 0 });
  }

  function setProvider(prefix: string | null) {
    if (prefix !== null && !registry().getProvider(prefix)) return;
    patch({ provider: prefix, category: null, activeIndex: 0 });
    if (getState().open) void load();
  }

  function setActiveIndex(index: number) {
    const count = getFilteredIcons().length;
    patch({ activeIndex: count ? clamp(Math.floor(index), 0, count - 1) : 0 });
  }

  function select(id: IconId) {
    const normalized = registry().normalize(id);
    if (!normalized) return;
    const value = registry().format(normalized);
    if (options.value === undefined) uncontrolledValue = value;
    const recents = pushRecent(normalized);
    const close = options.closeOnSelect ?? true;
    commit(s => ({
      ...s,
      ...(recents ? { recents } : null),
      ...(close ? { open: false } : null),
    }));
    const storage = features().recents ? (features().recents as { storage?: RecentsStorage }).storage : undefined;
    if (recents && storage) {
      try {
        void Promise.resolve(storage.set(recents)).catch(() => {});
      } catch {
        // ignore storage failures
      }
    }
    options.onChange?.(value);
    notify();
  }

  function clear() {
    if (options.value === undefined) uncontrolledValue = null;
    options.onChange?.(null);
    notify();
  }

  function open() {
    if (getState().open) return;
    setState(s => ({ ...s, open: true, activeIndex: initialActiveIndex({ ...s, open: true }) }));
    void load();
  }

  function close() {
    patch({ open: false });
  }

  function toggle() {
    if (getState().open) close();
    else open();
  }

  // ---------------------------------------------------------------- keyboard

  function moveActive(direction: MoveDirection) {
    const count = getFilteredIcons().length;
    if (count === 0) return;
    const cols = Math.max(1, Math.floor(options.columns ?? 1));
    const pageRows = Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE));
    const last = count - 1;
    const i = clamp(getState().activeIndex, 0, last);
    const rowStart = i - (i % cols);
    const lastRowStart = last - (last % cols);
    let n = i;
    switch (direction) {
      case 'left':
        n = i - 1;
        break;
      case 'right':
        n = i + 1;
        break;
      case 'up':
        n = i - cols >= 0 ? i - cols : i;
        break;
      case 'down':
        // Moving into a shorter last row lands on its last item.
        n = i + cols <= last ? i + cols : rowStart < lastRowStart ? last : i;
        break;
      case 'rowStart':
        n = rowStart;
        break;
      case 'rowEnd':
        n = Math.min(last, rowStart + cols - 1);
        break;
      case 'first':
        n = 0;
        break;
      case 'last':
        n = last;
        break;
      case 'pageUp':
        n = i - cols * pageRows;
        if (n < 0) n = i % cols;
        break;
      case 'pageDown':
        n = i + cols * pageRows;
        if (n > last) n = Math.min(last, lastRowStart + (i % cols));
        break;
    }
    setActiveIndex(clamp(n, 0, last));
  }

  function handleKeyDown(event: KeyboardEventLike): boolean {
    // Never hijack keys while an IME (e.g. 注音 / 拼音) is composing.
    if (event.isComposing || event.nativeEvent?.isComposing) return false;
    const s = getState();
    const ctrl = !!(event.ctrlKey || event.metaKey);
    let handled = true;

    if (!s.open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') open();
      else handled = false;
    } else {
      switch (event.key) {
        case 'ArrowUp':
          moveActive('up');
          break;
        case 'ArrowDown':
          moveActive('down');
          break;
        case 'ArrowLeft':
          moveActive('left');
          break;
        case 'ArrowRight':
          moveActive('right');
          break;
        case 'Home':
          moveActive(ctrl ? 'first' : 'rowStart');
          break;
        case 'End':
          moveActive(ctrl ? 'last' : 'rowEnd');
          break;
        case 'PageUp':
          moveActive('pageUp');
          break;
        case 'PageDown':
          moveActive('pageDown');
          break;
        case 'Enter': {
          const active = getActiveIcon();
          if (active) select(active.id);
          else handled = false;
          break;
        }
        case 'Escape':
          if (s.query) setQuery('');
          else close();
          break;
        default:
          handled = false;
      }
    }
    if (handled) event.preventDefault?.();
    return handled;
  }

  // ---------------------------------------------------------------- a11y

  function getItemId(icon: IconMeta): string {
    return `${baseId}-option-${cssSafe(icon.id)}`;
  }

  function getSearchA11y(): A11yProps {
    const s = getState();
    const active = s.open ? getActiveIcon() : null;
    return {
      role: 'combobox',
      'aria-expanded': s.open,
      'aria-controls': listboxId,
      'aria-autocomplete': 'list',
      'aria-label': messages().searchLabel,
      'aria-activedescendant': active ? getItemId(active) : undefined,
    };
  }

  function getGridA11y(): A11yProps {
    return {
      role: 'listbox',
      id: listboxId,
      'aria-label': messages().gridLabel,
    };
  }

  /**
   * `aria-selected` follows the WAI-ARIA combobox pattern: it marks the option that has
   * keyboard focus (the one referenced by `aria-activedescendant`).
   * `data-current` marks the icon that is the stored value; `data-active` mirrors keyboard focus for styling.
   */
  function getItemA11y(icon: IconMeta): A11yProps {
    const active = getActiveIcon();
    const isActive = !!active && active.id === icon.id;
    const isCurrent = getSelectedId() === icon.id;
    return {
      role: 'option',
      id: getItemId(icon),
      'aria-selected': isActive,
      'aria-label': messages().iconLabel(icon),
      'data-active': isActive ? 'true' : undefined,
      'data-current': isCurrent ? 'true' : undefined,
    };
  }

  function getAnnouncement(): string {
    const s = getState();
    const m = messages();
    switch (s.status) {
      case 'loading':
        return m.loading;
      case 'error':
        return m.error;
      case 'ready': {
        const count = getFilteredIcons().length;
        return count === 0 ? m.noResults : m.results(count);
      }
      default:
        return '';
    }
  }

  // ---------------------------------------------------------------- lifecycle

  function mount(): () => void {
    mountCount++;
    if (mountCount === 1) {
      void loadRecents();
      if (getState().open) void load();
    }
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      mountCount--;
    };
  }

  return {
    getState,
    getOptions: () => options,
    setOptions(next) {
      // Intentionally does not notify: safe to call during React render.
      options = functionalUpdate(next, options);
    },
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getValue,
    getSelectedId,
    getFilteredIcons,
    getRows,
    getCategories,
    getProviders: () => registry().getProviders(),
    getActiveIcon,
    getSelectedIcon,
    getRecentIcons,
    setQuery,
    setCategory,
    setProvider,
    setActiveIndex,
    select,
    clear,
    open,
    close,
    toggle,
    moveActive,
    handleKeyDown,
    getSearchA11y,
    getGridA11y,
    getItemA11y,
    getItemId,
    getAnnouncement,
    load,
    mount,
  };
}

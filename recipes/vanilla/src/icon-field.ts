/**
 * Unstyled reference UI for the vanilla icon picker (recipe — copy into your project and adapt).
 *
 * - Behaviour, state and a11y attributes come from `@open-tw/icon-picker-core`
 * - Icons are rendered with `@open-tw/icon-picker-dom`
 * - The grid is virtualised with `@tanstack/virtual-core` using `picker.getRows()`
 *
 * Only structural class names (`ip-*`) are emitted; all visuals live in the consumer's CSS.
 */
import {
  createIconPicker,
  type IconId,
  type IconMeta,
  type IconPicker,
  type IconPickerOptions,
} from '@open-tw/icon-picker-core';
import { applyAttrs, mountIcon, mountIconValue } from '@open-tw/icon-picker-dom';
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualizerOptions,
} from '@tanstack/virtual-core';

export interface IconFieldOptions<T> extends IconPickerOptions<T> {
  columns?: number;
  /** Row height in px (must match your CSS). Default 40. */
  rowHeight?: number;
  /** Icon size inside the grid. Default 20. */
  iconSize?: number;
  /** Icon shown on the trigger when nothing is selected. */
  placeholderIcon?: IconId;
  text?: Partial<IconFieldText>;
}

export interface IconFieldText {
  trigger: string;
  searchPlaceholder: string;
  allCategories: string;
  allProviders: string;
  recents: string;
  clear: string;
}

const defaultText: IconFieldText = {
  trigger: 'Choose icon',
  searchPlaceholder: 'Search…',
  allCategories: 'All categories',
  allProviders: 'All libraries',
  recents: 'Recent',
  clear: 'Clear',
};

export interface IconField<T> {
  picker: IconPicker<T>;
  /** Update the controlled value from outside (e.g. after loading a record). */
  setValue(value: T | null): void;
  destroy(): void;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v !== undefined) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

export function createIconField<T = string>(root: HTMLElement, options: IconFieldOptions<T>): IconField<T> {
  const { registry } = options;
  const columns = options.columns ?? 8;
  const rowHeight = options.rowHeight ?? 40;
  const iconSize = options.iconSize ?? 20;
  const text = { ...defaultText, ...options.text };

  // ------------------------------------------------------------- DOM skeleton
  const triggerIcon = h('span', { class: 'ip-trigger-icon' });
  const triggerText = h('span', { class: 'ip-trigger-text' });
  const trigger = h('button', { type: 'button', class: 'ip-trigger', 'aria-haspopup': 'listbox' }, [
    triggerIcon,
    triggerText,
  ]);

  const input = h('input', {
    type: 'text',
    class: 'ip-search',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: text.searchPlaceholder,
  });
  const providerSelect = h('select', { class: 'ip-provider', 'aria-label': text.allProviders });
  const categorySelect = h('select', { class: 'ip-category', 'aria-label': text.allCategories });
  const clearBtn = h('button', { type: 'button', class: 'ip-clear' }, [text.clear]);
  const toolbar = h('div', { class: 'ip-toolbar' }, [input, providerSelect, categorySelect, clearBtn]);

  const recentsList = h('div', { class: 'ip-recents-list' });
  const recents = h('div', { class: 'ip-recents', role: 'group', 'aria-label': text.recents }, [
    h('div', { class: 'ip-recents-label' }, [text.recents]),
    recentsList,
  ]);

  const sizer = h('div', { class: 'ip-sizer' });
  sizer.style.position = 'relative';
  sizer.style.width = '100%';
  const scroller = h('div', { class: 'ip-grid' }, [sizer]);
  scroller.style.overflowY = 'auto';

  const status = h('div', { class: 'ip-status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const popover = h('div', { class: 'ip-popover' }, [toolbar, recents, scroller, status]);
  popover.hidden = true;

  root.replaceChildren(trigger, popover);

  // ------------------------------------------------------------- picker
  const pickerOptions = (o: IconFieldOptions<T>): IconPickerOptions<T> => ({ ...o, columns });
  const picker = createIconPicker<T>(pickerOptions(options));
  const unmountPicker = picker.mount();

  // ------------------------------------------------------------- virtualizer (rows)
  const vOptions: VirtualizerOptions<HTMLDivElement, HTMLDivElement> = {
    count: 0,
    getScrollElement: () => scroller,
    estimateSize: () => rowHeight,
    overscan: 4,
    scrollToFn: elementScroll,
    observeElementRect,
    observeElementOffset,
    onChange: () => renderGrid(),
  };
  const virtualizer = new Virtualizer(vOptions);
  const unmountVirtualizer = virtualizer._didMount();
  virtualizer._willUpdate();

  const buttons = new Map<IconId, HTMLButtonElement>();

  function optionButton(icon: IconMeta): HTMLButtonElement {
    let btn = buttons.get(icon.id);
    if (!btn) {
      btn = h('button', { type: 'button', class: 'ip-option', tabindex: '-1' });
      btn.title = icon.name;
      // Keep focus in the search box (combobox pattern: focus never moves into the grid).
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => picker.select(icon.id));
      void mountIcon(btn, icon.id, { registry, size: iconSize });
      buttons.set(icon.id, btn);
    }
    applyAttrs(btn, picker.getItemA11y(icon));
    return btn;
  }

  function renderGrid() {
    const rows = picker.getRows();
    sizer.style.height = `${virtualizer.getTotalSize()}px`;
    const rowEls: HTMLElement[] = [];
    for (const item of virtualizer.getVirtualItems()) {
      const row = rows[item.index];
      if (!row) continue;
      const rowEl = h('div', { class: 'ip-row', role: 'presentation' }, row.map(optionButton));
      rowEl.style.cssText = `position:absolute;top:0;left:0;width:100%;height:${item.size}px;transform:translateY(${item.start}px)`;
      rowEls.push(rowEl);
    }
    sizer.replaceChildren(...rowEls);
  }

  // ------------------------------------------------------------- render from state
  let prev: {
    open?: boolean;
    rows?: unknown;
    categories?: unknown;
    recents?: unknown;
    value?: unknown;
    activeIndex?: number;
  } = {};

  function render() {
    const s = picker.getState();
    const value = picker.getValue();
    const rows = picker.getRows();
    const opening = s.open && !prev.open;

    // Trigger
    applyAttrs(trigger, { 'aria-expanded': s.open, 'aria-controls': s.open ? String(picker.getGridA11y().id) : undefined });
    if (prev.value !== value || prev.open === undefined) {
      const selected = picker.getSelectedId();
      triggerText.textContent = selected ? selected : text.trigger;
      if (selected) void mountIconValue(triggerIcon, value, { registry, size: iconSize });
      else void mountIcon(triggerIcon, options.placeholderIcon ?? null, { registry, size: iconSize });
    }

    popover.hidden = !s.open;
    if (!s.open) {
      prev = { ...prev, open: false, value };
      return;
    }

    // Search box
    if (input.value !== s.query) input.value = s.query;
    applyAttrs(input, picker.getSearchA11y());
    applyAttrs(scroller, picker.getGridA11y());

    // Providers (only when more than one library is registered)
    const providers = picker.getProviders();
    providerSelect.hidden = providers.length < 2;
    if (providers.length > 1 && providerSelect.options.length !== providers.length + 1) {
      providerSelect.replaceChildren(
        h('option', { value: '' }, [text.allProviders]),
        ...providers.map(p => h('option', { value: p.prefix }, [p.label])),
      );
    }
    providerSelect.value = s.provider ?? '';

    // Categories
    const categories = picker.getCategories();
    categorySelect.hidden = categories.length === 0;
    if (categories !== prev.categories) {
      categorySelect.replaceChildren(
        h('option', { value: '' }, [text.allCategories]),
        ...categories.map(c => h('option', { value: c.id }, [`${c.label} (${c.count})`])),
      );
    }
    categorySelect.value = s.category ?? '';

    // Recents (hidden while searching)
    const recentIcons = picker.getRecentIcons();
    recents.hidden = recentIcons.length === 0 || !!s.query || !!s.category;
    if (recentIcons !== prev.recents) {
      recentsList.replaceChildren(
        ...recentIcons.map(icon => {
          const btn = h('button', { type: 'button', class: 'ip-recent', 'aria-label': icon.name, title: icon.name });
          btn.addEventListener('mousedown', e => e.preventDefault());
          btn.addEventListener('click', () => picker.select(icon.id));
          void mountIcon(btn, icon.id, { registry, size: iconSize });
          return btn;
        }),
      );
    }

    // Grid
    if (rows !== prev.rows || opening) {
      virtualizer.setOptions({ ...vOptions, count: rows.length });
      virtualizer._willUpdate();
      if (rows !== prev.rows && !opening) scroller.scrollTop = 0;
    }
    renderGrid();
    if (s.activeIndex !== prev.activeIndex || opening) {
      if (rows.length) virtualizer.scrollToIndex(Math.floor(s.activeIndex / columns), { align: opening ? 'center' : 'auto' });
    }

    status.textContent = picker.getAnnouncement();

    if (opening) requestAnimationFrame(() => input.focus());

    prev = { open: true, rows, categories, recents: recentIcons, value, activeIndex: s.activeIndex };
  }

  // ------------------------------------------------------------- events
  const listeners: [EventTarget, string, EventListener][] = [];
  const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener);
    listeners.push([target, type, fn as EventListener]);
  };

  on(trigger, 'click', () => picker.toggle());
  // Preload data on intent so the first open is instant.
  on(trigger, 'pointerenter', () => void picker.load());
  on(trigger, 'focus', () => void picker.load());
  on(input, 'input', () => picker.setQuery(input.value));
  on<KeyboardEvent>(input, 'keydown', e => picker.handleKeyDown(e));
  on(providerSelect, 'change', () => picker.setProvider(providerSelect.value || null));
  on(categorySelect, 'change', () => picker.setCategory(categorySelect.value || null));
  on(clearBtn, 'click', () => picker.clear());
  on<KeyboardEvent>(popover, 'keydown', e => {
    // Escape from controls other than the search box (selects, recents) closes the popover.
    if (e.key === 'Escape' && e.target !== input) {
      picker.close();
      trigger.focus();
    }
  });
  on<PointerEvent>(document, 'pointerdown', e => {
    if (picker.getState().open && !root.contains(e.target as Node)) picker.close();
  });

  const unsubscribe = picker.subscribe(() => {
    const focusInside = popover.contains(document.activeElement);
    render();
    // Return focus to the trigger when the popover closes from inside (select / Escape).
    if (focusInside && !picker.getState().open) trigger.focus();
  });
  render();

  return {
    picker,
    setValue(value) {
      picker.setOptions(o => ({ ...o, value }));
      render(); // setOptions never notifies
    },
    destroy() {
      unsubscribe();
      unmountPicker();
      unmountVirtualizer();
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      root.replaceChildren();
    },
  };
}

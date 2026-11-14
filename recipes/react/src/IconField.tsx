/**
 * Unstyled reference UI for React (recipe — copy into your project and adapt, e.g. swap in MUI / Chakra parts).
 *
 * - Behaviour, state and a11y attributes come from `useIconPicker()`
 * - The grid is virtualised with `@tanstack/react-virtual` using `picker.getRows()`
 * - Only structural class names (`ip-*`) are emitted
 */
import type { IconId, IconPickerFeatures, IconPickerMessages } from '@open-tw/icon-picker-core';
import { Icon, useIconPicker, useIconRegistry } from '@open-tw/icon-picker-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

export interface IconFieldText {
  trigger: string;
  searchPlaceholder: string;
  allCategories: string;
  recents: string;
  clear: string;
}

export interface IconFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  columns?: number;
  /** Must match your CSS. */
  rowHeight?: number;
  features?: IconPickerFeatures;
  messages?: Partial<IconPickerMessages>;
  placeholderIcon?: IconId;
  text: IconFieldText;
}

export function IconField({
  value,
  onChange,
  columns = 8,
  rowHeight = 40,
  features,
  messages,
  placeholderIcon = 'lucide:image',
  text,
}: IconFieldProps) {
  const registry = useIconRegistry();
  const picker = useIconPicker({ registry, value, onChange, columns, pageSize: 8, features, messages });
  const { open, query, category, activeIndex } = picker.getState();
  const rows = picker.getRows();
  const categories = picker.getCategories();
  const recents = picker.getRecentIcons();

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  // Focus the search box on open; give focus back to the trigger when closing from inside the popover
  // (select / Escape). The popover is already unmounted when the effect runs, so track focus in a ref.
  const wasOpen = useRef(open);
  const focusInPopover = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) inputRef.current?.focus();
    if (!open && wasOpen.current && focusInPopover.current) triggerRef.current?.focus();
    if (!open) focusInPopover.current = false;
    wasOpen.current = open;
  }, [open]);

  // Keep the keyboard-active row visible.
  useEffect(() => {
    if (open && rows.length) virtualizer.scrollToIndex(Math.floor(activeIndex / columns), { align: 'auto' });
  }, [open, activeIndex, columns, rows.length, virtualizer]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        focusInPopover.current = false; // the user is moving focus elsewhere
        picker.close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, picker.close]);

  const selectedId = picker.getSelectedId();

  return (
    <div className="ip" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ip-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={picker.toggle}
        // Preload on intent so the first open is instant.
        onPointerEnter={() => void picker.load()}
        onFocus={() => void picker.load()}
      >
        <span className="ip-trigger-icon">
          {selectedId ? <Icon id={selectedId} /> : <Icon id={placeholderIcon} />}
        </span>
        <span className="ip-trigger-text">{selectedId ?? text.trigger}</span>
      </button>

      {open && (
        <div
          className="ip-popover"
          onFocus={() => {
            focusInPopover.current = true;
          }}
          onKeyDown={e => {
            if (e.key === 'Escape' && e.target !== inputRef.current) picker.close();
          }}
        >
          <div className="ip-toolbar">
            <input
              ref={inputRef}
              className="ip-search"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={text.searchPlaceholder}
              value={query}
              onChange={e => picker.setQuery(e.target.value)}
              onKeyDown={picker.handleKeyDown}
              {...picker.getSearchA11y()}
            />
            {categories.length > 0 && (
              <select
                className="ip-category"
                aria-label={text.allCategories}
                value={category ?? ''}
                onChange={e => picker.setCategory(e.target.value || null)}
              >
                <option value="">{text.allCategories}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="ip-clear" onClick={picker.clear}>
              {text.clear}
            </button>
          </div>

          {recents.length > 0 && !query && !category && (
            <div className="ip-recents" role="group" aria-label={text.recents}>
              <div className="ip-recents-label">{text.recents}</div>
              <div className="ip-recents-list">
                {recents.map(icon => (
                  <button
                    key={icon.id}
                    type="button"
                    className="ip-recent"
                    title={icon.name}
                    aria-label={icon.name}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => picker.select(icon.id)}
                  >
                    <Icon id={icon.id} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="ip-grid" style={{ overflowY: 'auto' }} {...picker.getGridA11y()}>
            <div className="ip-sizer" style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map(item => (
                <div
                  key={item.key}
                  className="ip-row"
                  role="presentation"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {rows[item.index]?.map(icon => (
                    <button
                      key={icon.id}
                      type="button"
                      className="ip-option"
                      tabIndex={-1}
                      title={icon.name}
                      // Combobox pattern: focus stays in the search box.
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => picker.select(icon.id)}
                      {...picker.getItemA11y(icon)}
                    >
                      <Icon id={icon.id} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="ip-status" aria-live="polite" aria-atomic="true">
            {picker.getAnnouncement()}
          </div>
        </div>
      )}
    </div>
  );
}

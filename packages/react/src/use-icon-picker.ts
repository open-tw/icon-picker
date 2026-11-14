import { createIconPicker, type IconPicker, type IconPickerOptions } from '@open-tw/icon-picker-core';
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';

interface PickerStore<T> {
  picker: IconPicker<T>;
  subscribe: (onChange: () => void) => () => void;
  getVersion: () => number;
}

function createStore<T>(options: IconPickerOptions<T>): PickerStore<T> {
  const picker = createIconPicker<T>(options);
  // Some changes do not produce a new state object (e.g. an uncontrolled value set by select()/clear()),
  // so React subscribes to a version number that bumps on every notification instead of to getState().
  // Registered first, so it always runs before React's own listener.
  let version = 0;
  picker.subscribe(() => {
    version++;
  });
  return { picker, subscribe: picker.subscribe, getVersion: () => version };
}

/**
 * Creates one picker instance per component and connects it to React.
 *
 * The returned object gets a new identity whenever the picker state, value or options-derived state change.
 * Its methods are always the same functions, so `onClick={picker.toggle}` is stable.
 * The changing identity keeps memoising compilers (React Compiler) and `memo()` children correct:
 * anything that reads from `picker` re-renders when the picker changes.
 */
export function useIconPicker<T = string>(options: IconPickerOptions<T>): IconPicker<T> {
  const reactId = useId();
  const [store] = useState(() => createStore<T>({ id: `icon-picker-${reactId}`, ...options }));
  const { picker } = store;

  // Does not notify, so it is safe during render.
  picker.setOptions(options);

  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  // mount() is re-entrant and its cleanup idempotent → safe with StrictMode's double effects.
  useEffect(() => picker.mount(), [picker]);

  // Controlled `state` / `value` arrive through setOptions() during render, without a notification.
  const state = picker.getState();
  const value = picker.getValue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...picker }), [picker, version, state, value, options.columns, options.filter]);
}

import { createIconPicker, type IconPicker, type IconPickerOptions } from '@open-tw/icon-picker-core';
import {
  getCurrentInstance,
  isReactive,
  isRef,
  markRaw,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  useId,
  watch,
  type MaybeRefOrGetter,
} from 'vue';

/**
 * Creates one picker instance and connects it to Vue's reactivity.
 *
 * `options` can be a plain object, a `reactive()` object, a ref, or — most useful — a getter, so props and
 * `defineModel()` stay in sync:
 *
 * ```ts
 * const model = defineModel<string | null>({ default: null });
 * const picker = useIconPicker(() => ({ registry, value: model.value, onChange: v => (model.value = v) }));
 * ```
 *
 * Every `get*()` method is tracked, so templates, `computed()` and `watch()` that read from the picker update
 * whenever it changes. Methods are plain functions: `@click="picker.toggle"` works.
 *
 * Works inside a component's `setup()`, and inside a bare `effectScope()` (e.g. a store), where it mounts
 * immediately instead of on `onMounted`.
 */
export function useIconPicker<T = string>(options: MaybeRefOrGetter<IconPickerOptions<T>>): IconPicker<T> {
  const instance = getCurrentInstance();
  const id = instance ? `icon-picker-${useId()}` : undefined;
  const picker = createIconPicker<T>({ ...(id ? { id } : {}), ...toValue(options) });

  // The core's state is not reactive. Every notification (and every options change) bumps a version
  // that each getter reads, so Vue re-runs whatever read from the picker.
  const version = shallowRef(0);
  const bump = () => {
    version.value++;
  };
  const unsubscribe = picker.subscribe(bump);

  if (isRef(options) || isReactive(options) || typeof options === 'function') {
    // Spread so every top-level option of a reactive object is tracked. `sync`: setOptions() never notifies,
    // so the new options are applied before anything (render or user code) reads the picker again.
    watch(
      () => ({ ...toValue(options) }),
      next => {
        picker.setOptions(next);
        bump();
      },
      { flush: 'sync' },
    );
  }

  // mount() loads recents and, if already open, the icon metadata — client only.
  let dispose: (() => void) | undefined;
  if (instance) {
    onMounted(() => {
      dispose = picker.mount();
    });
  } else {
    dispose = picker.mount();
  }
  onScopeDispose(() => {
    dispose?.();
    unsubscribe();
  });

  const tracked = {} as Record<string, unknown>;
  for (const [key, fn] of Object.entries(picker) as [string, (...args: unknown[]) => unknown][]) {
    tracked[key] = key.startsWith('get')
      ? (...args: unknown[]) => {
          void version.value;
          return fn(...args);
        }
      : fn;
  }
  // markRaw: never wrap the picker in a reactive proxy (e.g. when it is stored in reactive state).
  return markRaw(tracked) as unknown as IconPicker<T>;
}

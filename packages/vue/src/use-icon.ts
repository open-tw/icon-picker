import type { IconData, IconId } from '@open-tw/icon-picker-core';
import {
  computed,
  getCurrentInstance,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue';
import { registryGetter, type AnyRegistry } from './context.js';

interface Loaded {
  registry: AnyRegistry;
  id: IconId;
  data: IconData | null;
}

/**
 * Resolves an icon through the registry. Cached icons are available synchronously (also during SSR);
 * others load on the client after mount. Never returns data for a previous `id`.
 *
 * `id` and `registry` may be plain values, refs or getters (`() => props.id`).
 */
export function useIcon(
  id: MaybeRefOrGetter<IconId | null | undefined>,
  registry?: MaybeRefOrGetter<AnyRegistry | null | undefined>,
): ComputedRef<IconData | undefined> {
  const getRegistry = registryGetter(registry);
  getRegistry(); // throw early when there is no registry at all
  const loaded = shallowRef<Loaded | null>(null);
  let cancel: (() => void) | undefined;

  function start() {
    cancel?.();
    cancel = undefined;
    const reg = getRegistry();
    const target = toValue(id);
    if (!target || reg.getCached(target)) return;
    let alive = true;
    cancel = () => {
      alive = false;
    };
    void reg.resolve(target).then(data => {
      if (alive) loaded.value = { registry: reg, id: target, data };
    });
  }

  // Load only on the client: onMounted and non-immediate watchers do not run during SSR.
  if (getCurrentInstance()) onMounted(start);
  else start();
  watch([getRegistry, () => toValue(id)], start);
  onScopeDispose(() => cancel?.());

  return computed(() => {
    const reg = getRegistry();
    const target = toValue(id);
    const l = loaded.value; // tracked, so a finished load re-evaluates
    if (!target) return undefined;
    const cached = reg.getCached(target);
    if (cached) return cached;
    if (l && l.id === target && l.registry === reg) return l.data ?? undefined;
    return undefined;
  });
}

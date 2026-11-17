import type { IconRegistry } from '@open-tw/icon-picker-core';
import { inject, provide, toValue, type InjectionKey, type MaybeRefOrGetter, type Plugin } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRegistry = IconRegistry<any>;

/**
 * Injection key for the shared registry. The provided value may be a registry, a ref or a getter.
 * `app.provide(IconRegistryKey, registry)` works too.
 */
export const IconRegistryKey: InjectionKey<MaybeRefOrGetter<AnyRegistry>> = Symbol('IconRegistry');

const MISSING =
  '[icon-picker] No icon registry found. Call provideIconRegistry(registry) or app.use(createIconPickerPlugin(registry)), or pass `registry`.';

/**
 * Provides a registry to all descendants. Call it in `setup()`.
 * Pass a ref or getter to swap registries later: every `<Icon>` and `useIcon()` follows.
 */
export function provideIconRegistry<T>(registry: MaybeRefOrGetter<IconRegistry<T>>): void {
  provide(IconRegistryKey, registry);
}

/** App-wide plugin: `app.use(createIconPickerPlugin(registry))`. */
export function createIconPickerPlugin<T>(registry: MaybeRefOrGetter<IconRegistry<T>>): Plugin {
  return {
    install(app) {
      app.provide(IconRegistryKey, registry);
    },
  };
}

/**
 * The provided registry (its current value, if a ref was provided), or `override` when given.
 * Throws when neither exists. Call it in `setup()`.
 */
export function useIconRegistry<T = string>(override?: IconRegistry<T> | null): IconRegistry<T> {
  const registry = override ?? toValue(inject(IconRegistryKey, null));
  if (!registry) throw new Error(MISSING);
  return registry as IconRegistry<T>;
}

/**
 * Internal: a reactive getter for the registry — `override` (e.g. an `<Icon :registry>` prop) first,
 * then the provided one. `inject()` must run during setup, so it is resolved once up front.
 */
export function registryGetter(override?: MaybeRefOrGetter<AnyRegistry | null | undefined>): () => AnyRegistry {
  const injected = inject(IconRegistryKey, null);
  return () => {
    const registry = toValue(override) ?? toValue(injected);
    if (!registry) throw new Error(MISSING);
    return registry;
  };
}

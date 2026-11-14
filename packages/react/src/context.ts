import type { IconRegistry } from '@open-tw/icon-picker-core';
import { createContext, useContext } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRegistry = IconRegistry<any>;

const RegistryContext = createContext<AnyRegistry | null>(null);
RegistryContext.displayName = 'IconRegistryContext';

/**
 * `<IconRegistryProvider value={registry}>` at the app root.
 * Uses `Context.Provider` (not `<Context value>`) so it works on React 18 and 19.
 */
export const IconRegistryProvider = RegistryContext.Provider;

/** The registry from context, or `override` when given. Throws when neither exists. */
export function useIconRegistry<T = string>(override?: IconRegistry<T> | null): IconRegistry<T> {
  const fromContext = useContext(RegistryContext);
  const registry = override ?? fromContext;
  if (!registry) {
    throw new Error(
      '[icon-picker] No icon registry found. Wrap your app in <IconRegistryProvider value={registry}> or pass `registry`.',
    );
  }
  return registry as IconRegistry<T>;
}

import type { IconData, IconId, IconRegistry } from '@open-tw/icon-picker-core';
import { useEffect, useState } from 'react';
import { useIconRegistry } from './context.js';

interface Loaded {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry: IconRegistry<any>;
  id: IconId;
  data: IconData | null;
}

/**
 * Resolves an icon through the registry. Cached icons are returned synchronously on the first render;
 * others load in an effect. Never returns data for a previous `id`.
 */
export function useIcon(
  id: IconId | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registryOverride?: IconRegistry<any> | null,
): IconData | undefined {
  const registry = useIconRegistry(registryOverride);
  const cached = id ? registry.getCached(id) : undefined;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!id || cached) return;
    let alive = true;
    void registry.resolve(id).then(data => {
      if (alive) setLoaded({ registry, id, data });
    });
    return () => {
      alive = false;
    };
  }, [registry, id, cached]);

  if (cached) return cached;
  if (loaded && loaded.id === id && loaded.registry === registry) return loaded.data ?? undefined;
  return undefined;
}

import type { IconId, IconRegistry } from '@open-tw/icon-picker-core';
import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useIconRegistry } from './context.js';
import { useIcon } from './use-icon.js';

export interface IconProps
  extends Omit<ComponentPropsWithoutRef<'svg'>, 'id' | 'children' | 'dangerouslySetInnerHTML'> {
  /** Internal id, e.g. `lucide:chart-bar`. */
  id?: IconId | null;
  /** Stored value (parsed with the registry codec), e.g. the DB column. Ignored when `id` is given. */
  value?: unknown;
  /** Width / height. Default 20. */
  size?: number | string;
  /** Stroke icons only. Default 2. */
  strokeWidth?: number;
  /** Accessible name. Without it the icon is `aria-hidden`. */
  title?: string;
  /** Rendered while loading and when the icon cannot be resolved. Defaults to a same-size empty box. */
  fallback?: ReactNode;
  /** Defaults to the registry from `IconRegistryProvider`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry?: IconRegistry<any>;
}

/**
 * Unstyled `<svg>` icon. Uses `forwardRef` so the ref reaches the `<svg>` on React 18 and 19.
 *
 * `body` is injected with `dangerouslySetInnerHTML`: only use trusted, build-time generated icon data.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { id, value, size = 20, strokeWidth = 2, title, fallback, registry: registryProp, ...rest },
  ref,
) {
  const registry = useIconRegistry(registryProp);
  const parsed = useMemo(
    () => (id ? null : registry.parse(value as never)),
    [id, value, registry],
  );
  const data = useIcon(id ?? parsed, registry);

  if (!data) {
    if (fallback !== undefined) return <>{fallback}</>;
    return <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size }} />;
  }

  const stroke = data.style === 'stroke';
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${data.width} ${data.height}`}
      width={size}
      height={size}
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : undefined}
      strokeWidth={stroke ? strokeWidth : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-icon={data.id}
      {...rest}
      dangerouslySetInnerHTML={{ __html: data.body }}
    />
  );
});
Icon.displayName = 'Icon';

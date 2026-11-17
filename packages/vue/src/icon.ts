import type { IconId } from '@open-tw/icon-picker-core';
import { computed, defineComponent, h, type PropType, type SlotsType, type VNode } from 'vue';
import { registryGetter, type AnyRegistry } from './context.js';
import { useIcon } from './use-icon.js';

/**
 * Unstyled `<svg>` icon.
 *
 * - `id` takes an internal id (`lucide:chart-bar`); `value` takes a stored value parsed with the registry codec.
 * - Without `title` the icon is `aria-hidden`.
 * - Other attributes (`class`, `style`, listeners …) go to the `<svg>`, not to the placeholder.
 * - The `#fallback` slot is rendered while loading and when the icon cannot be resolved.
 *
 * `body` is injected with `innerHTML`: only use trusted, build-time generated icon data.
 */
export const Icon = defineComponent({
  name: 'Icon',
  inheritAttrs: false,
  props: {
    /** Internal id, e.g. `lucide:chart-bar`. */
    id: { type: String as PropType<IconId | null>, default: undefined },
    /** Stored value (parsed with the registry codec), e.g. the DB column. Ignored when `id` is given. */
    value: { type: null as unknown as PropType<unknown>, required: false },
    /** Width / height. Default 20. */
    size: { type: [Number, String] as PropType<number | string>, default: 20 },
    /** Stroke icons only. Default 2. */
    strokeWidth: { type: Number, default: 2 },
    /** Accessible name. Without it the icon is `aria-hidden`. */
    title: { type: String, default: undefined },
    /** Defaults to the provided registry. */
    registry: { type: Object as PropType<AnyRegistry>, default: undefined },
  },
  slots: Object as SlotsType<{ fallback?: () => VNode[] }>,
  setup(props, { attrs, slots }) {
    const getRegistry = registryGetter(() => props.registry);
    const iconId = computed(() => (props.id ? props.id : getRegistry().parse(props.value as never)));
    const data = useIcon(iconId, getRegistry);

    return () => {
      const icon = data.value;
      if (!icon) {
        if (slots.fallback) return slots.fallback();
        const size = typeof props.size === 'number' ? `${props.size}px` : props.size;
        return h('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: size, height: size } });
      }
      const stroke = icon.style === 'stroke';
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${icon.width} ${icon.height}`,
        width: props.size,
        height: props.size,
        fill: stroke ? 'none' : 'currentColor',
        stroke: stroke ? 'currentColor' : undefined,
        'stroke-width': stroke ? props.strokeWidth : undefined,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        focusable: 'false',
        role: props.title ? 'img' : undefined,
        'aria-label': props.title,
        'aria-hidden': props.title ? undefined : 'true',
        'data-icon': icon.id,
        ...attrs,
        innerHTML: icon.body,
      });
    };
  },
});

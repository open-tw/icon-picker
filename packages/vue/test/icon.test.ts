// @vitest-environment happy-dom
import { pascalCodec, type IconId } from '@open-tw/icon-picker-core';
import { flushPromises, mount } from '@vue/test-utils';
import { createSSRApp, defineComponent, h, ref, shallowRef, version as vueVersion } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Icon, IconRegistryKey, createIconPickerPlugin, provideIconRegistry, useIcon } from '../src/index.js';
import { makeRegistry } from './helpers.js';

describe(`<Icon /> (Vue ${vueVersion})`, () => {
  it('renders a fallback box, then the svg', async () => {
    const { registry } = makeRegistry();
    const wrapper = mount(Icon, { props: { id: 't:star', size: 16 }, global: { provide: { [IconRegistryKey]: registry } } });
    const placeholder = wrapper.get('span[aria-hidden="true"]');
    expect((placeholder.element as HTMLElement).style.width).toBe('16px');
    await flushPromises();
    const svg = wrapper.get('svg');
    expect(svg.attributes('data-icon')).toBe('t:star');
    expect(svg.attributes('stroke-width')).toBe('2');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.element.innerHTML).toBe('<path d="star"></path>');
  });

  it('renders cached icons on the first render', async () => {
    const { registry } = makeRegistry();
    await registry.resolve('t:star');
    const wrapper = mount(Icon, { props: { id: 't:star', registry } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('accepts a stored value through the codec, title, strokeWidth, and passes attrs to the svg', async () => {
    const { registry } = makeRegistry({ codec: pascalCodec({ prefix: 't', names: { ChartBar: 'chart-bar' } }) });
    const onClick = vi.fn();
    const wrapper = mount(Icon, {
      props: { value: 'ChartBar', title: 'Revenue', strokeWidth: 1.5 },
      attrs: { class: 'x', onClick },
      global: { plugins: [createIconPickerPlugin(registry)] },
    });
    // Attributes do not leak onto the placeholder.
    expect(wrapper.get('span').classes()).not.toContain('x');
    await flushPromises();
    const svg = wrapper.get('svg[role="img"]');
    expect(svg.attributes('aria-label')).toBe('Revenue');
    expect(svg.attributes('stroke-width')).toBe('1.5');
    expect(svg.classes()).toEqual(['x']);
    expect(svg.attributes('aria-hidden')).toBeUndefined();
    await svg.trigger('click');
    expect(onClick).toHaveBeenCalled();
  });

  it('shows the #fallback slot for unknown values', async () => {
    const { registry } = makeRegistry();
    const wrapper = mount(Icon, { props: { value: 'nope', registry }, slots: { fallback: () => h('i', { 'data-testid': 'fb' }) } });
    await flushPromises();
    expect(wrapper.find('[data-testid="fb"]').exists()).toBe(true);
  });

  it('follows a provided registry ref', async () => {
    const a = makeRegistry().registry;
    const b = makeRegistry({ codec: pascalCodec({ prefix: 't', names: { Star: 'star' } }) }).registry;
    const current = shallowRef(a);
    const wrapper = mount(
      defineComponent(() => {
        provideIconRegistry(current);
        return () => h(Icon, { value: current.value === a ? 't:star' : 'Star' });
      }),
    );
    await flushPromises();
    expect(wrapper.get('svg').attributes('data-icon')).toBe('t:star');
    current.value = b;
    await flushPromises();
    expect(wrapper.get('svg').attributes('data-icon')).toBe('t:star');
    expect(b.getCached('t:star')).toBeDefined(); // loaded through the new registry
  });

  it('throws a helpful error without a registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mount(Icon, { props: { id: 't:star' } })).toThrow(/provideIconRegistry/);
    warn.mockRestore();
  });

  it('renders the placeholder during SSR without loading', async () => {
    const { registry, provider } = makeRegistry();
    const app = createSSRApp(() => h(Icon, { id: 't:star', size: 24, class: 'x' }));
    app.provide(IconRegistryKey, registry);
    const html = await renderToString(app);
    expect(html).toBe('<span aria-hidden="true" style="display:inline-block;width:24px;height:24px;"></span>');
    expect(provider.loadIcons).not.toHaveBeenCalled();
  });
});

describe(`useIcon (Vue ${vueVersion})`, () => {
  it('never returns data for a previous id', async () => {
    const { registry } = makeRegistry();
    const id = ref<IconId>('t:star');
    const seen: (string | undefined)[][] = [];
    const wrapper = mount(
      defineComponent(() => {
        const data = useIcon(id, registry);
        return () => {
          seen.push([id.value, data.value?.id]);
          return null;
        };
      }),
    );
    await flushPromises();
    id.value = 't:heart';
    await flushPromises();
    for (const [i, dataId] of seen) if (dataId) expect(dataId).toBe(i);
    expect(seen[seen.length - 1]).toEqual(['t:heart', 't:heart']);
    wrapper.unmount();
  });
});

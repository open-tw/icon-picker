// @vitest-environment happy-dom
import {
  kebabCodec,
  type IconPicker,
  type IconPickerOptions,
  type IconPickerState,
  type IconRegistry,
  type RecentsStorage,
} from '@open-tw/icon-picker-core';
import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, effectScope, h, nextTick, reactive, ref, version as vueVersion, type PropType } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { Icon, provideIconRegistry, useIconPicker } from '../src/index.js';
import { makeRegistry } from './helpers.js';

/** Minimal field following the README example, written with render functions (no SFC compiler needed). */
const Field = defineComponent({
  props: {
    registry: { type: Object as PropType<IconRegistry>, required: true },
    options: { type: Object as PropType<Partial<IconPickerOptions>>, default: () => ({}) },
  },
  setup(props) {
    provideIconRegistry(props.registry);
    const picker = useIconPicker(() => ({ registry: props.registry, columns: 4, ...props.options }));
    return () => {
      const { open, query } = picker.getState();
      const value = picker.getValue();
      return h('div', [
        h('button', { type: 'button', 'data-testid': 'trigger', onClick: picker.toggle }, [
          value ? h(Icon, { value }) : h(Icon, { id: 't:image' }),
          h('span', { 'data-testid': 'value' }, String(value)),
        ]),
        h('button', { type: 'button', 'data-testid': 'clear', onClick: picker.clear }),
        open &&
          h('div', [
            h('input', {
              'data-testid': 'search',
              value: query,
              onInput: (e: Event) => picker.setQuery((e.target as HTMLInputElement).value),
              onKeydown: picker.handleKeyDown,
              ...picker.getSearchA11y(),
            }),
            h(
              'div',
              picker.getGridA11y(),
              picker.getFilteredIcons().map(icon =>
                h('button', { key: icon.id, type: 'button', onClick: () => picker.select(icon.id), ...picker.getItemA11y(icon) }, [
                  h(Icon, { id: icon.id }),
                ]),
              ),
            ),
            h('div', { 'data-testid': 'status' }, picker.getAnnouncement()),
          ]),
      ]);
    };
  },
});

async function openField(options: Partial<IconPickerOptions> = {}, registry = makeRegistry().registry) {
  const onChange = vi.fn();
  const wrapper = mount(Field, { props: { registry, options: { onChange, ...options } }, attachTo: document.body });
  await wrapper.get('[data-testid="trigger"]').trigger('click');
  await flushPromises();
  return { wrapper, onChange, registry };
}

const byLabel = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.get(`[aria-label="${label}"]`);

describe(`useIconPicker (Vue ${vueVersion})`, () => {
  it('opens, lazy-loads, searches and selects via keyboard', async () => {
    const { wrapper, onChange } = await openField();
    expect(wrapper.get('[data-testid="status"]').text()).toBe('8 icons found');
    expect(wrapper.findAll('[role="option"]')).toHaveLength(8);

    const search = wrapper.get('[role="combobox"]');
    await search.setValue('user');
    expect(wrapper.findAll('[role="option"]').map(o => o.attributes('aria-label'))).toEqual(['User', 'Users']);

    await search.trigger('keydown', { key: 'ArrowRight' });
    expect(search.attributes('aria-activedescendant')).toBe(byLabel(wrapper, 'Users').attributes('id'));
    await search.trigger('keydown', { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('t:users');
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false); // closed
    expect(wrapper.get('[data-testid="value"]').text()).toBe('t:users'); // uncontrolled value re-rendered
    wrapper.unmount();
  });

  it('re-renders for value changes that do not touch picker state (clear, closeOnSelect: false)', async () => {
    const { wrapper } = await openField({ closeOnSelect: false });
    await byLabel(wrapper, 'Star').trigger('click');
    expect(byLabel(wrapper, 'Star').attributes('data-current')).toBe('true');
    await wrapper.get('[data-testid="clear"]').trigger('click');
    expect(wrapper.get('[data-testid="value"]').text()).toBe('null');
    expect(byLabel(wrapper, 'Star').attributes('data-current')).toBeUndefined();
    wrapper.unmount();
  });

  it('works with v-model style two-way binding and a codec', async () => {
    const { registry } = makeRegistry({ codec: kebabCodec({ prefix: 't' }) });
    const model = ref<string | null>('star');
    const Controlled = defineComponent(() => () =>
      h('div', [
        h(Field, {
          registry,
          options: { value: model.value, onChange: (v: string | null) => (model.value = v), closeOnSelect: false },
        }),
        h('output', { 'data-testid': 'db' }, String(model.value)),
      ]),
    );
    const wrapper = mount(Controlled);
    await wrapper.get('[data-testid="trigger"]').trigger('click');
    await flushPromises();
    expect(byLabel(wrapper, 'Star').attributes('data-current')).toBe('true');
    // Opening puts keyboard focus on the current value.
    expect(byLabel(wrapper, 'Star').attributes('aria-selected')).toBe('true');
    await byLabel(wrapper, 'Heart').trigger('click');
    expect(wrapper.get('[data-testid="db"]').text()).toBe('heart');
    expect(byLabel(wrapper, 'Heart').attributes('data-current')).toBe('true');
    // External writes to the model reach the picker.
    model.value = 'user';
    await nextTick();
    expect(byLabel(wrapper, 'User').attributes('data-current')).toBe('true');
    wrapper.unmount();
  });

  it('supports partially controlled state (e.g. query synced to the URL)', async () => {
    const { registry } = makeRegistry();
    const query = ref('chart');
    const UrlSynced = defineComponent(() => () =>
      h('div', [
        h(Field, {
          registry,
          options: {
            state: { query: query.value },
            onStateChange: updater => {
              const next = typeof updater === 'function' ? updater({} as IconPickerState) : updater;
              query.value = next.query;
            },
          },
        }),
        h('output', { 'data-testid': 'url' }, query.value),
      ]),
    );
    const wrapper = mount(UrlSynced);
    await wrapper.get('[data-testid="trigger"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
    await wrapper.get('[role="combobox"]').setValue('house');
    expect(wrapper.get('[data-testid="url"]').text()).toBe('house');
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1);
    wrapper.unmount();
  });

  it('tracks get*() reads in computed() and applies reactive option changes', async () => {
    const { registry } = makeRegistry();
    let picker!: IconPicker;
    let rowCount!: () => number;
    const options = reactive({ registry, columns: 4 });
    const wrapper = mount(
      defineComponent(() => {
        picker = useIconPicker(options);
        const rows = computed(() => picker.getRows().length);
        rowCount = () => rows.value;
        return () => h('span', rows.value);
      }),
    );
    picker.open();
    await flushPromises();
    expect(rowCount()).toBe(2);
    expect(wrapper.text()).toBe('2');
    options.columns = 8;
    expect(rowCount()).toBe(1); // sync: applied before the next read
    await nextTick();
    expect(wrapper.text()).toBe('1');
    picker.setQuery('chart');
    expect(picker.getFilteredIcons()).toHaveLength(2);
    wrapper.unmount();
  });

  it('keeps methods as plain functions and is never proxied', async () => {
    const { registry } = makeRegistry();
    let picker!: IconPicker;
    mount(
      defineComponent(() => {
        picker = useIconPicker({ registry });
        return () => null;
      }),
    ).unmount();
    const state = reactive({ picker });
    expect(state.picker).toBe(picker);
  });

  it('loads recents once on mount and stops listening on unmount', async () => {
    const storage: RecentsStorage = { get: vi.fn(() => ['t:heart' as const]), set: vi.fn() };
    const { wrapper } = await openField({ features: { recents: { storage } } });
    await byLabel(wrapper, 'Star').trigger('click');
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenLastCalledWith(['t:star', 't:heart']);
    wrapper.unmount();
  });

  it('works inside a bare effectScope (e.g. a store)', async () => {
    const { registry } = makeRegistry();
    const scope = effectScope();
    const picker = scope.run(() => useIconPicker({ registry }))!;
    const count = scope.run(() => computed(() => picker.getFilteredIcons().length))!;
    picker.open();
    await flushPromises();
    expect(count.value).toBe(8);
    picker.setQuery('chart');
    expect(count.value).toBe(2);
    scope.stop();
  });

  it('generates distinct a11y ids per instance from useId', async () => {
    const { registry } = makeRegistry();
    const wrapper = mount(defineComponent(() => () => h('div', [h(Field, { registry }), h(Field, { registry })])));
    for (const t of wrapper.findAll('[data-testid="trigger"]')) await t.trigger('click');
    await flushPromises();
    const [a, b] = wrapper.findAll('[role="listbox"]');
    expect(a!.attributes('id')).not.toBe(b!.attributes('id'));
    expect(a!.attributes('id')).toMatch(/^[a-zA-Z0-9_-]+$/);
    wrapper.unmount();
  });
});

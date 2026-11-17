# Headless Icon Picker

A headless, framework-agnostic icon picker. Search, browse by category and pick an icon. The result is a plain string such as `lucide:chart-bar` that you can store in your database.

**[Live demo](https://open-tw.github.io/icon-picker/)** · vanilla, React and Vue

- **Headless**: all behaviour (search, categories, recents, 2-D keyboard navigation, ARIA attributes) lives in one framework-agnostic instance. You bring the markup and styles.
- **Pluggable icon sets**: icons come from providers. [Lucide](https://lucide.dev) ships first, with 2,000+ icons whose data is loaded lazily on first open.
- **Your storage format**: store `lucide:chart-bar`, `ChartBar` or `chart-bar`. Codecs convert between the stored value and icon ids.
- **React 18 and 19**: StrictMode, SSR-safe ids and React Compiler are all supported.
- **Vue 3**: composables with `v-model` (`defineModel`), SSR and `effectScope` support.
- **Accessible**: follows the WAI-ARIA combobox pattern, and IME-aware keyboard handling ignores keys while a CJK input method is composing.

## Packages

| Package | Description |
| --- | --- |
| [`@open-tw/icon-picker-core`](packages/core) | Registry, picker instance, codecs, search, keyboard and a11y. No DOM, no runtime dependencies |
| [`@open-tw/icon-picker-react`](packages/react) | `useIconPicker`, `useIcon`, `<Icon />` |
| [`@open-tw/icon-picker-vue`](packages/vue) | Vue 3: `useIconPicker`, `useIcon`, `<Icon />` |
| [`@open-tw/icon-picker-dom`](packages/dom) | Vanilla helpers: `mountIcon`, `renderIcon`, `applyAttrs` |
| [`@open-tw/icon-provider-lucide`](packages/provider-lucide) | Lucide icons, categories and aliases for renamed icons |

All packages are ESM only and MIT licensed.

## Quick start (React)

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-picker-react @open-tw/icon-provider-lucide
```

```tsx
import { createIconRegistry } from '@open-tw/icon-picker-core';
import { Icon, useIconPicker } from '@open-tw/icon-picker-react';
import { lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] });

function IconField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const picker = useIconPicker({ registry, value, onChange, columns: 8 });
  const { open, query } = picker.getState();

  return (
    <>
      <button type="button" onClick={picker.toggle}>
        <Icon value={value} registry={registry} />
      </button>
      {open && (
        <div>
          <input value={query} onChange={e => picker.setQuery(e.target.value)} onKeyDown={picker.handleKeyDown} {...picker.getSearchA11y()} />
          <div {...picker.getGridA11y()}>
            {picker.getFilteredIcons().map(icon => (
              <button key={icon.id} type="button" onClick={() => picker.select(icon.id)} {...picker.getItemA11y(icon)}>
                <Icon id={icon.id} registry={registry} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

## Quick start (Vue 3)

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-picker-vue @open-tw/icon-provider-lucide
```

```vue
<script setup lang="ts">
import { createIconRegistry } from '@open-tw/icon-picker-core';
import { Icon, useIconPicker } from '@open-tw/icon-picker-vue';
import { lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] }); // share one per app in real code
const model = defineModel<string | null>({ default: null });
const picker = useIconPicker(() => ({ registry, value: model.value, onChange: v => (model.value = v), columns: 8 }));
</script>

<template>
  <button type="button" @click="picker.toggle"><Icon :value="model" :registry="registry" /></button>
  <div v-if="picker.getState().open">
    <input
      :value="picker.getState().query"
      v-bind="picker.getSearchA11y()"
      @input="picker.setQuery(($event.target as HTMLInputElement).value)"
      @keydown="picker.handleKeyDown"
    />
    <div v-bind="picker.getGridA11y()">
      <button v-for="icon in picker.getFilteredIcons()" :key="icon.id" type="button" v-bind="picker.getItemA11y(icon)" @click="picker.select(icon.id)">
        <Icon :id="icon.id" :registry="registry" />
      </button>
    </div>
  </div>
</template>
```

See the [React](packages/react), [Vue](packages/vue) and [vanilla](packages/dom) package READMEs for more. For full, unstyled reference implementations with a virtualized grid, see [`recipes/react`](recipes/react), [`recipes/vue`](recipes/vue) and [`recipes/vanilla`](recipes/vanilla).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Lucide icon data is ISC licensed; see [`packages/provider-lucide`](packages/provider-lucide).

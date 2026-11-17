# @open-tw/icon-picker-vue

Vue 3 bindings for [`@open-tw/icon-picker-core`](https://www.npmjs.com/package/@open-tw/icon-picker-core). Supports **Vue 3.5+**, `v-model` (`defineModel`), SSR and use outside components (`effectScope`, stores).

**Demo:** <https://open-tw.github.io/icon-picker/vue/>

## Install

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-picker-vue @open-tw/icon-provider-lucide
```

ESM only. Peer dependency: `vue` `^3.5`. Ships plain `.js` + `.d.ts`, so no SFC compiler setup is needed.

## Usage

Share one registry (and its cache) across the app:

```ts
// main.ts
import { createIconRegistry } from '@open-tw/icon-picker-core';
import { createIconPickerPlugin } from '@open-tw/icon-picker-vue';
import { lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] });
createApp(App).use(createIconPickerPlugin(registry)).mount('#app');
```

An icon field with `v-model`:

```vue
<!-- IconField.vue -->
<script setup lang="ts">
import { Icon, useIconPicker, useIconRegistry } from '@open-tw/icon-picker-vue';

const model = defineModel<string | null>({ default: null });
const registry = useIconRegistry();
// A getter keeps the picker in sync with the model and props.
const picker = useIconPicker(() => ({
  registry,
  value: model.value,
  onChange: v => (model.value = v),
  columns: 8,
}));
</script>

<template>
  <button type="button" @click="picker.toggle">
    <Icon :value="model">
      <template #fallback><Icon id="lucide:image" /></template>
    </Icon>
  </button>
  <div v-if="picker.getState().open">
    <input
      :value="picker.getState().query"
      v-bind="picker.getSearchA11y()"
      @input="picker.setQuery(($event.target as HTMLInputElement).value)"
      @keydown="picker.handleKeyDown"
    />
    <div v-bind="picker.getGridA11y()">
      <button
        v-for="icon in picker.getFilteredIcons()"
        :key="icon.id"
        type="button"
        v-bind="picker.getItemA11y(icon)"
        @click="picker.select(icon.id)"
      >
        <Icon :id="icon.id" />
      </button>
    </div>
  </div>
</template>
```

```vue
<IconField v-model="widget.icon" />
```

For large icon sets, render only the visible rows from `picker.getRows()` with `@tanstack/vue-virtual`. See [`recipes/vue`](https://github.com/open-tw/icon-picker/tree/main/recipes/vue) for a complete, unstyled reference implementation.

## API

- **`useIconPicker(options)`** — creates one picker. `options` may be a plain object, a `reactive()` object, a ref or a getter (`() => ({ … })`); changes are applied synchronously. Every `get*()` method is reactive, so templates, `computed()` and `watch()` update when the picker changes. Methods are plain functions (`@click="picker.toggle"`), and the picker is `markRaw`, so it is safe to keep in reactive state. Outside a component (inside an `effectScope()`), it mounts immediately and is cleaned up when the scope stops.
- **`<Icon :id | :value :size :stroke-width :title :registry />`** — unstyled `<svg>`. `value` takes a stored value (parsed with the registry codec). Without `title` the icon is `aria-hidden`. Other attributes and listeners (`class`, `@click` …) go to the `<svg>`. The `#fallback` slot renders while loading and for unknown icons; the default is a same-size empty box.
- **`useIcon(id, registry?)`** — returns a `ComputedRef<IconData | undefined>`. `id` may be a value, ref or getter. Cached icons are available immediately.
- **`provideIconRegistry(registry)`**, **`createIconPickerPlugin(registry)`**, **`useIconRegistry()`**, **`IconRegistryKey`** — share one registry. `provideIconRegistry` and the plugin also accept a ref or getter, so swapping the registry updates every `<Icon>`.

During SSR, `<Icon />` renders a same-size placeholder (or cached icons) and loads nothing; icons load on the client after mount.

## License

MIT

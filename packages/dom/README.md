# @open-tw/icon-picker-dom

Vanilla DOM helpers for [`@open-tw/icon-picker-core`](https://www.npmjs.com/package/@open-tw/icon-picker-core).

**Demo:** <https://open-tw.github.io/icon-picker/>

## Install

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-picker-dom @open-tw/icon-provider-lucide
```

ESM only.

## API

| Function | Description |
| --- | --- |
| `renderIcon(data, { size, strokeWidth, title, attrs })` | Returns an `<svg>` string (works for `innerHTML` and server-side HTML) |
| `mountIcon(el, id, { registry, size, … })` | Resolves an icon id and puts the `<svg>` into `el`. Cached icons render synchronously; the latest call per element wins |
| `mountIconValue(el, value, { registry, … })` | Same, for a stored value (parsed with the registry codec) |
| `applyAttrs(el, attrs)` | Writes `getSearchA11y()` / `getItemA11y()` objects onto an element and removes stale attributes |
| `localStorageRecents(key?)` | `RecentsStorage` backed by `localStorage` |

```ts
import { createIconRegistry, createIconPicker } from '@open-tw/icon-picker-core';
import { applyAttrs, mountIcon } from '@open-tw/icon-picker-dom';
import { lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] });
const picker = createIconPicker({ registry, columns: 8, onChange: value => save(value) });
picker.mount();

input.addEventListener('input', () => picker.setQuery(input.value));
input.addEventListener('keydown', e => picker.handleKeyDown(e));

picker.subscribe(() => {
  applyAttrs(input, picker.getSearchA11y());
  applyAttrs(grid, picker.getGridA11y());
  grid.replaceChildren(
    ...picker.getFilteredIcons().map(icon => {
      const btn = document.createElement('button');
      btn.type = 'button';
      applyAttrs(btn, picker.getItemA11y(icon));
      btn.addEventListener('click', () => picker.select(icon.id));
      mountIcon(btn, icon.id, { registry, size: 20 });
      return btn;
    }),
  );
});
```

For large icon sets, render only the visible rows from `picker.getRows()` with a virtualizer such as `@tanstack/virtual-core`.

Icon bodies are inserted as HTML: only use trusted, build-time generated icon data.

## License

MIT

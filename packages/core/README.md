# @open-tw/icon-picker-core

Headless, framework-agnostic icon picker. All behaviour — search, categories, recents, 2-D keyboard navigation and ARIA attributes — lives in one instance with no DOM access and no runtime dependencies. Bring your own UI.

**Demo:** <https://open-tw.github.io/icon-picker/>

- **Headless**: returns data, functions and plain attribute objects (`{ role, id, 'aria-*' }`); no styles, no DOM props
- **Pluggable icon libraries** via providers (e.g. [`@open-tw/icon-provider-lucide`](https://www.npmjs.com/package/@open-tw/icon-provider-lucide))
- **Configurable storage format** via codecs: `lucide:chart-bar`, `ChartBar` or `chart-bar`
- **Controlled or uncontrolled** state (TanStack-style `state` + `onStateChange`)

Framework bindings: [`@open-tw/icon-picker-react`](https://www.npmjs.com/package/@open-tw/icon-picker-react) · vanilla helpers: [`@open-tw/icon-picker-dom`](https://www.npmjs.com/package/@open-tw/icon-picker-dom).

## Install

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-provider-lucide
```

ESM only.

## Usage

```ts
import { createIconRegistry, createIconPicker } from '@open-tw/icon-picker-core';
import { lucide } from '@open-tw/icon-provider-lucide';

// One registry per app: it caches icon data and owns the storage codec.
const registry = createIconRegistry({ providers: [lucide] });

const picker = createIconPicker({
  registry,
  columns: 8,
  onChange: value => save(value), // "lucide:chart-bar"
  features: { search: true, categories: true, recents: true },
});
const unmount = picker.mount();

picker.subscribe(() => render(picker.getState(), picker.getFilteredIcons()));
picker.open(); // lazy-loads the icon metadata on first open
picker.setQuery('chart');
input.addEventListener('keydown', e => picker.handleKeyDown(e));
```

### Storage formats

| Codec | Stored value |
| --- | --- |
| `prefixedCodec()` (default) | `lucide:chart-bar` |
| `pascalCodec({ prefix: 'lucide', names: lucideComponentNames })` | `ChartBar` |
| `kebabCodec({ prefix: 'lucide' })` | `chart-bar` |

Values that cannot be parsed return `null` and call the registry's `onInvalidValue`.

### Instance API

| | |
| --- | --- |
| State | `getState()`, `setOptions()`, `setState()`, `subscribe()` |
| Derived | `getFilteredIcons()`, `getRows()`, `getCategories()`, `getProviders()`, `getActiveIcon()`, `getSelectedIcon()`, `getRecentIcons()` |
| Actions | `setQuery`, `setCategory`, `setProvider`, `setActiveIndex`, `select`, `clear`, `open`, `close`, `toggle` |
| Keyboard | `moveActive(direction)`, `handleKeyDown(event)` |
| a11y | `getSearchA11y()`, `getGridA11y()`, `getItemA11y(icon)`, `getAnnouncement()` |
| Lifecycle | `load()`, `mount()` |

Keyboard: arrows move in two dimensions, Home/End go to the row start/end, Ctrl+Home/End to the first/last result, PageUp/PageDown move by `pageSize` rows, Enter selects, Escape clears the query and then closes. Keys are ignored while an IME is composing.

## License

MIT

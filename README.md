# Headless Icon Picker

A headless, framework-agnostic icon picker. Search, browse by category and pick an icon. The result is a plain string such as `lucide:chart-bar` that you can store in your database.

**[Live demo](https://open-tw.github.io/icon-picker/)** · vanilla and React

- **Headless**: all behaviour (search, categories, recents, 2-D keyboard navigation, ARIA attributes) lives in one framework-agnostic instance. You bring the markup and styles.
- **Pluggable icon sets**: icons come from providers. [Lucide](https://lucide.dev) ships first, with 2,000+ icons whose data is loaded lazily on first open.
- **Your storage format**: store `lucide:chart-bar`, `ChartBar` or `chart-bar`. Codecs convert between the stored value and icon ids.
- **React 18 and 19**: StrictMode, SSR-safe ids and React Compiler are all supported.
- **Accessible**: follows the WAI-ARIA combobox pattern, and IME-aware keyboard handling ignores keys while a CJK input method is composing.

## Packages

| Package | Description |
| --- | --- |
| [`@open-tw/icon-picker-core`](packages/core) | Registry, picker instance, codecs, search, keyboard and a11y. No DOM, no runtime dependencies |
| [`@open-tw/icon-picker-react`](packages/react) | `useIconPicker`, `useIcon`, `<Icon />` |
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

See the [React](packages/react) and [vanilla](packages/dom) package READMEs for more. For full, unstyled reference implementations with a virtualized grid, see [`recipes/react`](recipes/react) and [`recipes/vanilla`](recipes/vanilla).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Lucide icon data is ISC licensed; see [`packages/provider-lucide`](packages/provider-lucide).

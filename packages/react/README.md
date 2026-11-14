# @open-tw/icon-picker-react

React bindings for [`@open-tw/icon-picker-core`](https://www.npmjs.com/package/@open-tw/icon-picker-core). Supports **React 18 and 19**, StrictMode and React Compiler.

**Demo:** <https://open-tw.github.io/icon-picker/>

## Install

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-picker-react @open-tw/icon-provider-lucide
```

ESM only. Peer dependency: `react` `^18 || ^19`.

## Usage

```tsx
import { createIconRegistry } from '@open-tw/icon-picker-core';
import { Icon, IconRegistryProvider, useIconPicker, useIconRegistry } from '@open-tw/icon-picker-react';
import { lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] });

export function App() {
  return (
    <IconRegistryProvider value={registry}>
      <Dashboard />
    </IconRegistryProvider>
  );
}

function IconField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const picker = useIconPicker({ registry: useIconRegistry(), value, onChange, columns: 8 });
  const { open, query } = picker.getState();

  return (
    <>
      <button type="button" onClick={picker.toggle}>
        <Icon value={value} fallback={<Icon id="lucide:image" />} />
      </button>
      {open && (
        <div>
          <input
            value={query}
            onChange={e => picker.setQuery(e.target.value)}
            onKeyDown={picker.handleKeyDown}
            {...picker.getSearchA11y()}
          />
          <div {...picker.getGridA11y()}>
            {picker.getFilteredIcons().map(icon => (
              <button key={icon.id} type="button" onClick={() => picker.select(icon.id)} {...picker.getItemA11y(icon)}>
                <Icon id={icon.id} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

For large icon sets, render only the visible rows from `picker.getRows()` with `@tanstack/react-virtual`.

## API

- **`useIconPicker(options)`** — creates one picker per component. Its methods are stable (`onClick={picker.toggle}`), but the returned object gets a **new identity whenever the picker changes**, so `memo()` children and React Compiler re-render correctly. Don't put `picker` itself in effect dependencies; use the methods or state you need.
- **`<Icon id | value size strokeWidth title fallback registry />`** — unstyled `<svg>`. `value` takes a stored value (parsed with the registry codec). Without `title` the icon is `aria-hidden`. Forwards `ref` to the `<svg>`.
- **`useIcon(id, registry?)`** — resolves `IconData`; cached icons are returned on the first render.
- **`IconRegistryProvider`**, **`useIconRegistry()`** — share one registry (and its cache) across the app.

On the server, `<Icon />` renders a same-size placeholder until the icon data is loaded on the client.

## License

MIT

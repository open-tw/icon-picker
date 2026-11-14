# @open-tw/icon-provider-lucide

[Lucide](https://lucide.dev) icons for [`@open-tw/icon-picker-core`](https://www.npmjs.com/package/@open-tw/icon-picker-core).

**Demo:** <https://open-tw.github.io/icon-picker/>

- Icon data is generated at build time from the official `lucide-static` package and the Lucide repository (tags, categories, renamed icons), pinned to one Lucide version
- Metadata and SVG bodies are loaded with dynamic `import()`, so they stay out of your main bundle (~70 KB + ~95 KB gzip, loaded on first use)
- Renamed icons resolve through aliases, e.g. `lucide:bar-chart-horizontal` → `lucide:chart-bar`
- No dependency on `lucide-react` or other runtime packages

## Install

```sh
npm install @open-tw/icon-picker-core @open-tw/icon-provider-lucide
```

ESM only.

## Usage

```ts
import { createIconRegistry } from '@open-tw/icon-picker-core';
import { LUCIDE_VERSION, lucide } from '@open-tw/icon-provider-lucide';

const registry = createIconRegistry({ providers: [lucide] });
```

### Storing lucide-react component names

If your data stores component names (`ChartBar`), use `pascalCodec` with the generated lookup table. It is a separate entry point, so apps that store `lucide:chart-bar` don't ship it:

```ts
import { createIconRegistry, pascalCodec } from '@open-tw/icon-picker-core';
import { lucide } from '@open-tw/icon-provider-lucide';
import { lucideComponentNames } from '@open-tw/icon-provider-lucide/component-names';

const registry = createIconRegistry({
  providers: [lucide],
  codec: pascalCodec({ prefix: 'lucide', names: lucideComponentNames }),
});
registry.parse('ArrowUp10'); // "lucide:arrow-up-1-0"
registry.parse('ChartBarIcon'); // "lucide:chart-bar"
```

## License

The package code is MIT. The icon data in `generated/` is derived from Lucide (ISC) and includes icons derived from Feather (MIT); see [`generated/LICENSE-lucide`](./generated/LICENSE-lucide).

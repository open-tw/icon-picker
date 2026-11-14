import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point workspace packages at their sources so the recipe hot-reloads without a build step.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@open-tw\/icon-picker-core$/, replacement: pkg('core/src/index.ts') },
      { find: /^@open-tw\/icon-picker-dom$/, replacement: pkg('dom/src/index.ts') },
      { find: /^@open-tw\/icon-provider-lucide\/component-names$/, replacement: pkg('provider-lucide/src/component-names.ts') },
      { find: /^@open-tw\/icon-provider-lucide$/, replacement: pkg('provider-lucide/src/index.ts') },
    ],
  },
});

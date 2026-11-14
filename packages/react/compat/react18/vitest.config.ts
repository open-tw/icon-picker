import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const local = (pkg: string) => realpathSync(here(`./node_modules/${pkg}`));

export default defineConfig({
  root: here('../..'), // packages/react
  resolve: {
    alias: [
      { find: /^@open-tw\/icon-picker-core$/, replacement: here('../../../core/src/index.ts') },
      // The shared test files and the adapter source would otherwise resolve React 19 from packages/react.
      { find: /^react-dom(\/.*)?$/, replacement: `${local('react-dom')}$1` },
      { find: /^react(\/.*)?$/, replacement: `${local('react')}$1` },
      { find: /^@testing-library\/react$/, replacement: local('@testing-library/react') },
    ],
  },
  test: {
    include: ['test/**/*.test.tsx'],
    exclude: ['test/react-compiler.test.tsx'],
  },
});

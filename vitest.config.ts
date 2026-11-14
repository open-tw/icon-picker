import { transformAsync } from '@babel/core';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Runs babel-plugin-react-compiler on `*.compiled.tsx` test fixtures (JSX is left for Vite). */
function reactCompiler(): Plugin {
  return {
    name: 'test:react-compiler',
    enforce: 'pre',
    async transform(code, id) {
      if (!/\.compiled\.tsx$/.test(id)) return null;
      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }]],
        plugins: [['babel-plugin-react-compiler', { target: '19', panicThreshold: 'all_errors' }]],
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}

export const workspaceAliases = [
  { find: /^@open-tw\/icon-picker-core$/, replacement: src('./packages/core/src/index.ts') },
  { find: /^@open-tw\/icon-picker-dom$/, replacement: src('./packages/dom/src/index.ts') },
  { find: /^@open-tw\/icon-picker-react$/, replacement: src('./packages/react/src/index.ts') },
  { find: /^@open-tw\/icon-provider-lucide\/component-names$/, replacement: src('./packages/provider-lucide/src/component-names.ts') },
  { find: /^@open-tw\/icon-provider-lucide$/, replacement: src('./packages/provider-lucide/src/index.ts') },
];

export default defineConfig({
  plugins: [reactCompiler()],
  resolve: { alias: workspaceAliases },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
  },
});

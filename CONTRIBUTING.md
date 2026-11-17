# Contributing

## Setup

Requires Node 24 (as in CI) and pnpm 9. The pnpm version is pinned in `package.json` (`packageManager`), so `corepack enable` is enough. Without pnpm installed, prefix commands with `npx pnpm@9.15.9`.

```sh
pnpm install
pnpm dev                # vanilla recipe (Vite, uses package sources directly)
pnpm dev:react          # React recipe
pnpm dev:vue            # Vue recipe
pnpm typecheck          # packages, tests, React 18 types and all recipes (Vue SFCs via vue-tsc)
pnpm test               # vitest with React 19, then the React 18 compatibility suite
pnpm test:react18       # only the React 18 suite
pnpm build              # tsc -b → packages/*/dist
```

## Repository layout

| Path | |
| --- | --- |
| `packages/core` | Framework-agnostic registry, picker, codecs, search |
| `packages/dom` | Vanilla DOM helpers |
| `packages/react` | React bindings |
| `packages/vue` | Vue 3 bindings |
| `packages/react/compat/react18` | Private package that runs the same React tests against React 18.3 and `@types/react` 18 |
| `packages/provider-lucide` | Lucide provider and its generated data |
| `recipes/vanilla`, `recipes/react`, `recipes/vue` | Unstyled reference UIs (not published), deployed as the demo |
| `docs/` | Planning document and design decisions (zh-TW) |

## React 18 and 19

The React package supports both majors from one codebase, so only use APIs that exist in both: `useSyncExternalStore`, `useId`, `forwardRef` and `Context.Provider`. Avoid `use()`, ref-as-prop, `<Context value>` and the global `JSX` namespace.

`useIconPicker` returns a new object identity whenever the picker changes, while its methods stay stable. React Compiler and `memo()` rely on this. `packages/react/test/react-compiler.test.tsx` compiles a component with the real compiler and fails if the identity is made stable.

## Vue

`packages/vue` is plain TypeScript (render functions, no `.vue` files), so it is built by `tsc -b` like the other packages and needs no SFC compiler. The core is not reactive: `useIconPicker` bumps a version ref on every notification and on every options change, and every `get*()` method reads it, which is how templates and `computed()` track the picker.

TypeScript 7 has no JavaScript API, which `vue-tsc` needs, so `recipes/vue` pins its own TypeScript 6 just for type-checking its `.vue` files.

## Updating Lucide

Icon data in `packages/provider-lucide/generated/` is committed, so consumers never need network access. To upgrade:

1. Bump `lucide-static` in `packages/provider-lucide/package.json`.
2. Run `pnpm install` and then `pnpm generate:lucide`.
3. Review the diff and commit `generated/`.

The generator works in two steps:

- It reads SVG bodies and tags from `lucide-static`.
- `lucide-static` has no categories or rename information, so the generator also downloads the Lucide repository at the matching tag. From it, it reads `icons/*.json` and `categories/*.json`, and expands `$extends:` categories. It also regenerates `generated/LICENSE-lucide`.

## Releasing

Releases use [changesets](https://github.com/changesets/changesets). The five public packages are `fixed`: they are always versioned together.

```sh
pnpm changeset          # describe your change (patch / minor / major); commit the generated file
pnpm check:packages     # after pnpm build: packs each package and checks contents, publint and attw
```

GitHub Actions workflows:

- **`ci.yml`**: typecheck, build, tests (React 19 and 18, Vue 3) and `check:packages` on every push and pull request.
- **`release.yml`**: on `main`, opens a "Version Packages" pull request while changesets are pending. Merging it publishes to npm.
- **`pages.yml`**: builds the recipes and deploys the demo to GitHub Pages.

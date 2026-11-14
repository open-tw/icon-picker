# Headless Icon Picker

依照《Headless Icon Picker 規劃文件》實作的第一期：core、vanilla 與 React（18／19）。

線上 demo：<https://open-tw.github.io/icon-picker/>

## 套件

| 套件 | 路徑 | 內容 |
| --- | --- | --- |
| `@open-tw/icon-picker-core` | `packages/core` | `createIconRegistry`、`createIconPicker`、codecs（`prefixedCodec` / `kebabCodec` / `pascalCodec`）、搜尋、鍵盤導覽、無障礙屬性。無執行期相依、不碰 DOM |
| `@open-tw/icon-picker-dom` | `packages/dom` | `renderIcon`、`mountIcon`、`mountIconValue`、`applyAttrs`、`localStorageRecents` |
| `@open-tw/icon-picker-react` | `packages/react` | `useIconPicker`、`useIcon`、`<Icon />`、`IconRegistryProvider`、`useIconRegistry`。peer：`react ^18 \|\| ^19` |
| `@open-tw/icon-provider-lucide` | `packages/provider-lucide` | `lucide` provider；`/component-names` 子路徑提供 `lucideComponentNames`（給 `pascalCodec`） |
| recipe（不發佈） | `recipes/vanilla` | 無樣式參考 UI（`src/icon-field.ts`），搭配 `@tanstack/virtual-core` 虛擬捲動 |
| recipe（不發佈） | `recipes/react` | 無樣式參考 UI（`src/IconField.tsx`），搭配 `@tanstack/react-virtual` |

## 指令

```sh
pnpm install            # 沒有全域 pnpm 可用：npx pnpm@9.15.9 install
pnpm dev                # 啟動 vanilla recipe（Vite，直接吃各套件 src）
pnpm dev:react          # 啟動 React recipe
pnpm test               # vitest（React 19）＋ React 18 相容測試
pnpm test:react18       # 只跑 React 18 相容測試
pnpm typecheck
pnpm build              # tsc -b → packages/*/dist
pnpm generate:lucide    # 重新產生 Lucide 資料（升級 lucide-static 版本後執行）
```

## Lucide 資料

`packages/provider-lucide/scripts/generate.ts` 在 build time 產生 `generated/`（已 commit，使用端不需網路）：

- SVG 內容與 tags 來自 `lucide-static`（版本鎖定）
- `lucide-static` 沒有 categories 與改名資訊，所以另外下載**同版本 tag** 的 Lucide repo tarball，讀 `icons/*.json` 與 `categories/*.json`（`$extends:` 會展開成被繼承 icon 的分類）
- `meta.js` 與 `bodies.js` 透過 dynamic import 載入，打包時自動成為獨立 chunk（約 70 KB + 95 KB gzip），不進主 bundle

## 與規劃文件的差異／補充決定

- **`pascalCodec` 需要傳入對照表**：`pascalCodec({ prefix: 'lucide', names: lucideComponentNames })`。對照表約 78 KB，放在獨立子路徑，只有使用 pascal 格式的專案才會打包到。
- **`aria-selected` 依 WAI-ARIA combobox 模式標示鍵盤焦點所在的 option**；資料庫中目前的值另以 `data-current` 標示，`data-active` 方便寫樣式。
- **新增的 options**：`defaultValue`（非受控初始值）、`pageSize`（PageUp/PageDown 的列數，預設 5）、`closeOnSelect`（預設 true）、`id`（a11y id 前綴）。
- **新增的 instance 成員**：`getValue()`、`getSelectedId()`、`getRecentIcons()`、`getItemId()`、`getOptions()`、`setState()`。
- **`onStateChange` 收到的是算好的完整下一個 state**（仍符合 `Updater<IconPickerState>`）。
- **IME**：`handleKeyDown` 在 `isComposing` 時不攔截，避免注音選字時的 Enter 被當成選取。
- **State 容器**：未決事項中選擇自寫輕量 store（約 30 行），不引入 `@tanstack/store`。
- `features` 預設：search 開、categories 開、recents 關。

## React 18 / 19 相容

同一份程式碼支援兩個版本，測試與型別檢查兩個版本都會跑：

- `pnpm test`：根目錄 vitest 用 React 19；`packages/react/compat/react18` 用 React 18.3.1 與 `@types/react` 18 跑**同一份**測試檔
- 只用兩版共通的 API：`useSyncExternalStore`、`useId`、`forwardRef`、`Context.Provider`；不使用 React 19 才有的 `use()`、ref-as-prop、`<Context value>`
- 型別只用 `React.ComponentPropsWithoutRef<'svg'>` 等兩版都有的型別，不用全域 `JSX`

### `useIconPicker` 的回傳值

- 方法永遠是同一個函式（`onClick={picker.toggle}` 是穩定的）
- **物件本身在 state、value、`columns`、`filter` 改變時會換新參照**。這是為了 React Compiler 與 `memo()`：它們依 `picker` 的參照決定要不要重新計算，若參照永遠不變，畫面會停在舊資料（`test/react-compiler.test.tsx` 用真正的 compiler 編譯元件驗證；改回穩定參照時這個測試會失敗）
- 因此不要把 `picker` 本身放進 `useEffect` 的依賴，請改放需要的方法或 state 片段
- 訂閱的是每次通知都會遞增的版本號，而不是 `getState()`，所以非受控 value 的變化（`select()`、`clear()` 不一定會產生新 state）也會觸發重新渲染
- a11y id 由 `useId()` 產生，SSR hydration 不會對不上

## 發佈（公開 npm）

四個 `@open-tw/*` 套件以 MIT 授權發佈到公開 npm（`publishConfig.access: public`），並用 changesets 設為 `fixed`：一起升版、版本號一致。`@open-tw/icon-provider-lucide` 另附 Lucide（ISC）與 Feather（MIT）的授權原文：`generated/LICENSE-lucide`，由 `pnpm generate:lucide` 自動產生。

```sh
pnpm changeset          # 記錄這次修改（patch / minor / major）
pnpm check:packages     # 實際打包並檢查：LICENSE、README、無 .tsbuildinfo、workspace 依賴已替換、publint、attw
```

CI（`.github/workflows/`）：

- `ci.yml`：型別檢查、build、React 19／18 測試、`check:packages`
- `release.yml`：main 上有待發佈的 changeset 時開「Version Packages」PR，合併後自動 `changeset publish`（需要 repo secret `NPM_TOKEN`），並附上 npm provenance
- `pages.yml`：把 `recipes/vanilla`、`recipes/react` 建置後部署到 GitHub Pages（首頁在 `.github/pages/index.html`）

> 注意：`release.yml` 在每次 push 到 main 時執行。只要設好 `NPM_TOKEN`，而 npm 上還沒有目前的版本，push 後就會直接發佈。

### 第一次發佈前的待辦

- [x] 建立 git repo 並推上 GitHub（changesets 依賴 git 歷史）
- [ ] 在 npm 建立（或確認擁有）`open-tw` organization
- [ ] 在 GitHub repo 設定 `NPM_TOKEN` secret（npm automation／granular token，需有 `@open-tw` 的發佈權限）
- [x] 在四個套件的 package.json 填上 `repository`、`homepage`、`bugs`，再把 `release.yml` 的 `NPM_CONFIG_PROVENANCE` 改成 `true`
- [ ] 在 GitHub repo Settings → Pages 把 Source 設成「GitHub Actions」（demo 才會部署）

目前版本為 `0.1.0`，第一次發佈不需要 changeset：`changeset publish` 會直接發佈 registry 上還沒有的版本。

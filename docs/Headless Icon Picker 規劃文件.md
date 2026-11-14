# Headless Icon Picker 規劃文件

Nov 13, 2026 · @Kao

## 背景與目標

為 Dashboard 建立一套 headless icon picker：第一期以 Lucide 為 icon 來源，支援 React 與 vanilla JS，架構上保留之後新增框架與 icon 庫的空間。

目標：

- 使用者可以搜尋、依分類瀏覽並選取 icon，結果以 `lucide:chart-bar` 這種格式存進資料庫
- 核心邏輯與 UI 完全分離：不提供任何樣式，由使用端用自家元件組裝畫面
- React 與 vanilla 共用同一個 core，API 盡量一致（參考 TanStack Table 的設計）
- 新增 icon 庫只需要新增一個 provider，不必改動 core，也不必遷移既有資料

第一期不做：

- Vue、Svelte 等其他框架的 adapter（架構預留，但不實作）
- 綁定特定 UI kit 的正式套件（MUI、Chakra 改以可複製的 recipe 提供）
- icon 上傳、編輯，以及自訂 icon 的管理後台

## 設計原則

所有行為只寫在一個與框架無關的 core instance 裡，各框架的 adapter 只負責把它的 state 接到自己的 reactivity 系統。

1. **一個 core instance，多個薄 adapter**：搜尋、分類、鍵盤導覽等邏輯只實作一次。React adapter 大約 20 行，vanilla 則直接使用 core。
2. **API 只輸出資料、函式與純屬性物件**：不回傳 `onChange`、`className` 這類特定框架才有的 DOM props，無障礙屬性則以 `{ role, id, 'aria-*' }` 這種純物件提供。
3. **受控與非受控 state 並存**：仿照 TanStack 的 `state` + `onStateChange`，使用端可以把部分 state 拉到外面管理（例如同步到 URL），也可以全部交給 picker。
4. **功能模組化**：搜尋、分類、最近使用、多個 icon 庫切換都是可以開關的 feature。
5. **資料與渲染分離**：所有 icon 都先轉成統一的 `IconData`，渲染時一律輸出 `<svg>`，不依賴 `lucide-react` 這類套件。
6. **內部 id 固定，儲存格式可以設定**：core 內部一律使用 `prefix:name`；存進資料庫的格式由 registry 的 codec 決定，預設是 `prefix:name`，也可以改存 `IconName` 等格式（見「儲存格式」）。不論哪種格式，都不存 SVG 原始碼。

## 架構總覽

&#91;embedded content: icon picker 分層架構 · 5 層\]

箭頭表示「使用」關係。替換或新增框架只動 adapter 那一層，替換或新增 icon 庫只動 provider 那一層；內部始終以 `prefix:name` 識別 icon，資料庫的儲存格式則由 codec 決定。

## 套件結構

採用 pnpm monorepo，第一期發佈 4 個套件，UI 範例不發佈（scope 為 `@open-tw`）。

| 套件 | 內容 | 相依 |
| --- | --- | --- |
| `@open-tw/icon-picker-core` | `createIconRegistry`、`createIconPicker`、搜尋、分類、鍵盤導覽、無障礙屬性 | 無執行期相依 |
| `@open-tw/icon-provider-lucide` | Lucide provider，以及在 build time 產生 meta 與 SVG body 的腳本 | `lucide-static` 與 Lucide 官方 metadata（只在 build time 用到） |
| `@open-tw/icon-picker-dom` | vanilla 用的 `renderIcon()`、`mountIcon()` | core |
| `@open-tw/icon-picker-react` | `useIconPicker()`、`useIcon()`、`<Icon />`、`IconRegistryProvider` | core；`react` 為 peer dependency |
| `recipes/`（不發佈） | 無樣式的參考 UI，之後加上 MUI、Chakra 的範例 | 複製到使用端專案裡使用 |

虛擬捲動不放進 core，由使用端自行搭配 `@tanstack/react-virtual` 或 `@tanstack/virtual-core`，讓 core 完全不碰 DOM。

## Icon 資料層

每個 icon 都以 `prefix:name` 識別，由 provider 轉成統一的 `IconData`，再交給 registry 負責解析與快取。Core 和渲染層都只認得這個格式。

### Id 格式

- 格式為 `<prefix>:<name>`，例如 `lucide:chart-bar`，沿用 Iconify 的命名慣例
- `prefix` 對應到 provider；`name` 使用來源庫的 kebab-case 名稱，不自行改名
- 這是內部使用的標準 id；資料庫實際存什麼格式由 codec 決定（見下方「儲存格式」）

### 型別

```ts
type IconId = `${string}:${string}`;

interface IconMeta {
  id: IconId;
  name: string;          // "chart-bar"
  label?: string;        // 顯示名稱，可做 i18n
  tags: string[];        // 搜尋關鍵字
  categories: string[];
}

interface IconData extends IconMeta {
  body: string;          // <svg> 內部的元素字串
  width: number;         // viewBox 寬高
  height: number;
  style: 'stroke' | 'fill';
}

interface IconProvider {
  prefix: string;                                   // "lucide"
  label: string;                                    // "Lucide"
  loadMeta(): Promise<IconMeta[]>;                  // 列表與搜尋用
  loadIcons(names: string[]): Promise<IconData[]>;  // 批次取得 SVG body
  aliases?: Record<string, string>;                 // 舊名 → 新名
}

interface IconRegistry<T = string> {
  getProviders(): IconProvider[];
  loadMeta(prefix?: string): Promise<IconMeta[]>;
  resolve(id: IconId): Promise<IconData | null>;
  resolveMany(ids: IconId[]): Promise<Map<IconId, IconData>>;
  getCached(id: IconId): IconData | undefined;      // 同步讀取快取，給渲染層用
  parse(value: T): IconId | null;                   // 資料庫的值 → 內部 id（經由 codec）
  format(id: IconId): T;                            // 內部 id → 存進資料庫的值
}

interface IconValueCodec<T = string> {
  parse(value: T): IconId | null;
  format(id: IconId): T;
}

declare function createIconRegistry<T = string>(options: {
  providers: IconProvider[];
  codec?: IconValueCodec<T>;                        // 預設 prefixedCodec()
  onInvalidValue?: (value: T) => void;
}): IconRegistry<T>;
```

Picker 與 `<Icon />` 共用同一個 registry，所以 picker 裡已經載入的 icon，Dashboard 其他地方渲染時不會重複載入。

### 儲存格式

內部 id 固定是 `prefix:name`；存進資料庫的格式由 registry 的 codec 決定，只在 `value` 進來與 `onChange` 出去時轉換。Picker 與 `<Icon />` 共用同一個 registry，整個應用只需要設定一次。

| Codec | 存進資料庫的值 | 適合情境 |
| --- | --- | --- |
| `prefixedCodec()`（預設） | `lucide:chart-bar` | 新專案，或之後可能混用多個 icon 庫 |
| `pascalCodec({ prefix })` | `ChartBar` | 既有資料存的是 lucide-react 元件名稱 |
| `kebabCodec({ prefix })` | `chart-bar` | 既有資料存的是 Lucide 原始名稱 |
| 自訂 `IconValueCodec` | 任意格式，例如 `{ lib, name }` 物件 | 有特殊的儲存需求 |

```ts
const registry = createIconRegistry({
  providers: [lucide],
  codec: pascalCodec({ prefix: 'lucide' }),  // 資料庫存 "ChartBar"
});
```

- **`pascalCodec` 用查表轉換，不用字串規則**：元件名稱遇到數字時規則不一致，例如 `ArrowUp10` 對應的是 `arrow-up-1-0`。Build 腳本從 Lucide metadata 產生「元件名 ↔ 原始名」對照表，並接受 `ChartBarIcon`、`LucideChartBar` 等別名，以及改名前的舊名稱。
- **沒有 prefix 的格式只能對應一個 icon 庫**：`pascalCodec` 和 `kebabCodec` 都必須指定 `prefix`。之後要混用多個庫時，寫一支遷移腳本，用舊 codec `parse`、新 codec `format` 即可。
- **對不到的值**：`parse` 回傳 `null` 時，`<Icon />` 顯示 fallback，picker 顯示未選取，並呼叫 `onInvalidValue` 讓使用端記錄或處理。

### Lucide provider

- 資料來源改用 Lucide 官方發佈的 SVG 與 metadata（tags、categories），不經過 `@iconify-json/lucide` 這一層中介，由 build 腳本直接轉成 IconData；Lucide 一發版就能跟著升級，不必等第三方重新打包
- 之後接入其他 icon 庫時，再逐一評估要用原套件還是 `@iconify-json/*`；不論哪種來源，provider 介面都不變
- Build 腳本產出兩類檔案：meta（name、tags、categories）和 SVG body，兩者分開，方便分別 lazy load
- Lucide 的 `style` 固定為 `stroke`，viewBox 為 24×24
- 版本鎖定；升級時保留改名對照（aliases），registry 解析 id 時會先查 aliases

## Core API

`createIconPicker(options)` 回傳一個 instance，裡面包含 state、衍生資料、操作方法與訂閱機制，React 和 vanilla 都直接操作這個 instance。

### Options 與 state

```ts
interface IconPickerOptions<T = string> {
  registry: IconRegistry<T>;
  value?: T | null;                            // 受控的選取值（儲存格式）
  onChange?: (value: T | null) => void;        // 回傳儲存格式
  initialState?: Partial<IconPickerState>;
  state?: Partial<IconPickerState>;            // 部分受控
  onStateChange?: (updater: Updater<IconPickerState>) => void;
  features?: {
    search?: boolean | { fields?: ('name' | 'tags' | 'label')[] };
    categories?: boolean;
    recents?: boolean | { max?: number; storage?: RecentsStorage };
  };
  columns?: number;                            // 網格欄數，給鍵盤導覽用
  filter?: (icon: IconMeta) => boolean;        // 白名單或黑名單
  messages?: Partial<IconPickerMessages>;      // i18n 文字
}

interface IconPickerState {
  open: boolean;
  query: string;
  category: string | null;
  provider: string | null;                     // 目前瀏覽的 icon 庫
  activeIndex: number;                         // 鍵盤焦點所在的位置
  recents: IconId[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}
```

### Instance 成員

| 分類 | 成員 | 說明 |
| --- | --- | --- |
| 狀態 | `getState()`、`setOptions(next)`、`subscribe(fn)` | `setOptions` 不發出通知，可以安全地在 React render 中呼叫 |
| 衍生資料 | `getFilteredIcons()`、`getRows()`、`getCategories()`、`getProviders()`、`getActiveIcon()`、`getSelectedIcon()` | 根據相關的 state 片段做 memo |
| 操作 | `setQuery`、`setCategory`、`setProvider`、`setActiveIndex`、`select(id)`、`clear()`、`open()`、`close()`、`toggle()` | 全部會走受控或非受控的更新流程 |
| 鍵盤 | `moveActive(dir)`、`handleKeyDown(event)` | `handleKeyDown` 只讀 `event.key`，與框架無關 |
| 無障礙 | `getSearchA11y()`、`getGridA11y()`、`getItemA11y(icon)`、`getAnnouncement()` | 回傳純屬性物件或文字 |
| 載入 | `load()` | 第一次 `open()` 時自動呼叫，也可以提前預載 |
| 生命週期 | `mount()` | 開始運作並回傳 cleanup；可以重複呼叫，相容 React StrictMode 重複執行 effect 的行為 |

### 實作要點

- State 更新一律經過 `setState(updater)`：受控的部分交給 `onStateChange` 處理，其餘寫進內部 store，之後通知所有訂閱者
- `getState()` 在 state 沒有變化時必須回傳同一個物件參照，`useSyncExternalStore` 依賴這一點
- 搜尋比對 name、tags、label，不分大小寫，完全符合 → 前綴符合 → 包含符合依序排列；Lucide 目前約 1,700 多個 icon，不需要全文索引套件
- `getRows()` 依 `columns` 把結果切成列，提供給使用端的虛擬列表使用

## React adapter

React adapter 只做三件事：用 `useSyncExternalStore` 訂閱 core 的 state、透過 context 提供 registry、提供一個不帶樣式的 `<Icon />`。

### Hooks

```tsx
const RegistryContext = createContext<IconRegistry | null>(null);
export const IconRegistryProvider = RegistryContext.Provider; // value={registry}

export function useIconPicker(options: IconPickerOptions) {
  const [picker] = useState(() => createIconPicker(options));
  picker.setOptions(options);                       // 不發通知，可在 render 中呼叫
  useSyncExternalStore(picker.subscribe, picker.getState, picker.getState);
  useEffect(() => picker.mount(), [picker]);        // mount() 回傳 cleanup
  return picker;
}

export function useIcon(id: IconId | null) {
  const registry = useContext(RegistryContext)!;
  const [data, setData] = useState(() => (id ? registry.getCached(id) : undefined));
  useEffect(() => {
    if (!id) { setData(undefined); return; }
    let alive = true;
    registry.resolve(id).then(d => { if (alive) setData(d ?? undefined); });
    return () => { alive = false; };
  }, [registry, id]);
  return data;
}
```

### `<Icon />`

```tsx
export function Icon({ id, size = 20, strokeWidth = 2, title, ...rest }: IconProps) {
  const data = useIcon(id);
  if (!data) return <span aria-hidden style={{ display: 'inline-block', width: size, height: size }} />;
  const stroke = data.style === 'stroke';
  return (
    <svg
      viewBox={`0 0 ${data.width} ${data.height}`}
      width={size}
      height={size}
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : undefined}
      strokeWidth={stroke ? strokeWidth : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: data.body }}
      {...rest}
    />
  );
}
```

Lucide 原始 SVG 把 `stroke`、`stroke-width` 等屬性寫在最外層的 `<svg>` 上。Build 腳本只取內部元素存成 `body`，外層屬性統一由 `<Icon />` 設定，`strokeWidth` 才能由使用端控制。

`<Icon />` 同時接受 `id`（內部 id）與 `value`（資料庫裡的值，經由 registry 的 codec 轉換），Dashboard 顯示已儲存的 icon 時，直接把欄位值傳給 `value` 即可。

### 使用範例

```tsx
function IconField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const picker = useIconPicker({
    registry,
    value,
    onChange,
    columns: 8,
    features: { search: true, categories: true, recents: true },
  });
  const { open, query } = picker.getState();

  return (
    <>
      <button type="button" onClick={picker.toggle}>
        {value ? <Icon value={value} /> : <Icon id="lucide:image" />}
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

這個範例為了易讀而省略了虛擬列表；實際的參考 UI 會用 `getRows()` 搭配 `@tanstack/react-virtual`。應用程式根節點只需要包一層 `<IconRegistryProvider value={registry}>`。

## Vanilla 使用方式

Vanilla 不另外包一層 adapter，而是直接使用 core instance，再搭配 `@open-tw/icon-picker-dom` 的兩個小工具。

- `renderIcon(data, opts)`：回傳 SVG 字串，可以用在 `innerHTML` 或伺服器端產生 HTML
- `mountIcon(el, id, opts)`：非同步解析 id 後把 `<svg>` 放進 `el`，回傳 `Promise<void>`

```ts
import { createIconRegistry, createIconPicker } from '@open-tw/icon-picker-core';
import { lucide } from '@open-tw/icon-provider-lucide';
import { mountIcon } from '@open-tw/icon-picker-dom';

const registry = createIconRegistry({ providers: [lucide] });
const picker = createIconPicker({ registry, columns: 8, onChange: id => save(id) });
const unmount = picker.mount();

const input = document.querySelector<HTMLInputElement>('#icon-search')!;
const grid = document.querySelector<HTMLElement>('#icon-grid')!;
setAttrs(input, picker.getSearchA11y());
setAttrs(grid, picker.getGridA11y());

input.addEventListener('input', () => picker.setQuery(input.value));
input.addEventListener('keydown', e => picker.handleKeyDown(e));

picker.subscribe(() => {
  grid.replaceChildren(
    ...picker.getFilteredIcons().map(icon => {
      const btn = document.createElement('button');
      btn.type = 'button';
      setAttrs(btn, picker.getItemA11y(icon));
      btn.addEventListener('click', () => picker.select(icon.id));
      mountIcon(btn, icon.id, { registry, size: 20 });
      return btn;
    }),
  );
});

function setAttrs(el: Element, attrs: Record<string, string | number | boolean>) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
}
```

範例每次都重繪整個網格，只是為了示意。實作時應該用 `getRows()` 搭配 `@tanstack/virtual-core`，只更新可見範圍。

### React 與 vanilla 的對照

| 動作 | React | Vanilla |
| --- | --- | --- |
| 建立 picker | `useIconPicker(options)` | `createIconPicker(options)` + `mount()` |
| 讀取 state | `picker.getState()`，會自動重新渲染 | `picker.getState()` + `subscribe()` |
| 搜尋、選取、鍵盤 | `setQuery`、`select`、`handleKeyDown` | 完全相同 |
| 無障礙屬性 | 展開 `getItemA11y(icon)` | `setAttribute` 寫入同一個物件 |
| 渲染 icon | `<Icon id />` | `mountIcon(el, id)` 或 `renderIcon(data)` |

## 效能與載入策略

Picker 必須列出整個 icon 庫，無法靠 tree-shaking 縮小打包體積，所以採用「開啟時才載入、只渲染可見範圍、載入過就快取」的策略。

- **第一期：開啟時 lazy load 整份資料**。Lucide provider 在第一次 `open()` 時用 dynamic import 載入 meta 與 body，不進入主 bundle。
- **擴充策略：meta 與 body 分開載入**。如果實測整份資料太大，或之後同時開放多個 icon 庫，就先只載 meta，body 依可見範圍批次載入；provider 介面已經拆成 `loadMeta` 和 `loadIcons`，切換時不必改 API。
- **虛擬列表**。Core 提供 `getRows()`，使用端搭配 TanStack Virtual，只渲染可見的幾列。
- **快取**。Registry 把解析過的 icon 留在記憶體；Dashboard 同一頁有多個 icon 時，用 `resolveMany()` 批次載入。是否需要寫進 IndexedDB 等持久快取，第一期先不做，依實測結果決定。
- **白名單**。用 `filter` option 在執行期篩選，或在 build time 只產出子集，例如只開放適合 Dashboard 的 200–300 個 icon。
- **預載**。使用者把滑鼠移到觸發按鈕上或讓它取得焦點時，就可以先呼叫 `picker.load()`，縮短開啟時的等待。

## 無障礙與鍵盤操作

採用 combobox 搭配 listbox 的模式：焦點始終留在搜尋框，目前選到哪個 icon 由 `aria-activedescendant` 指向，方向鍵在網格中以二維方式移動。

| 按鍵 | 行為 |
| --- | --- |
| ↑ ↓ | 上一列、下一列（移動 `columns` 格） |
| ← → | 上一個、下一個 |
| Home / End | 該列的第一個、最後一個 |
| Ctrl+Home / Ctrl+End | 全部結果的第一個、最後一個 |
| PageUp / PageDown | 一次移動一頁（可見列數） |
| Enter | 選取目前的 icon |
| Escape | 有搜尋字串時先清空，沒有則關閉 picker |
| Tab | 不攔截，照常離開 picker |

Core 提供的無障礙屬性：

- `getSearchA11y()`：`role="combobox"`、`aria-expanded`、`aria-controls`、`aria-activedescendant`、`aria-autocomplete="list"`
- `getGridA11y()`：`role="listbox"`、`id`、`aria-label`
- `getItemA11y(icon)`：`role="option"`、`id`、`aria-selected`、`aria-label`（icon 名稱或 label）
- `getAnnouncement()`：給 `aria-live` 區域播報的文字，例如「找到 24 個 icon」

Icon 本身一律加上 `aria-hidden`，名稱放在外層按鈕的 `aria-label`。所有文字都可以透過 `messages` option 替換，支援 i18n。

## 開發階段與里程碑

&#91;embedded content: 開發階段 · 4 個階段、3 道關卡\]

階段 0 到 2 構成第一期，每個階段都要通過關卡才進入下一個階段；各階段的時程待估算。

## 風險與未決事項

### 風險

| 風險 | 影響 | 因應方式 |
| --- | --- | --- |
| Lucide 改名或移除 icon | 資料庫裡的 id 對不到 icon | 鎖定版本；升級時在 CI 檢查資料庫用到的 id 是否仍存在，並維護 aliases |
| SVG 注入 | `body` 以 innerHTML 插入，可能執行惡意內容 | 只接受 build time 產出的可信資料；之後支援自訂 SVG 時必須先 sanitize |
| 不同 icon 庫風格不一 | 線條與填色、網格尺寸不同，混用時視覺不一致 | 用 `style` 與 viewBox 處理渲染差異；是否允許混用由設計把關 |
| Render 中呼叫 `setOptions` | 若發出通知，React 會警告 render 期間更新 state | `setOptions` 保證不發通知，並以測試鎖住這個行為 |
| 首次開啟等待載入 | 使用者看到空白或 loading | hover 或 focus 時預載；實測資料大小後決定是否拆分 meta 與 body |

### 未決事項

- [x] State 容器：自寫輕量 store（約 30 行），不引入 `@tanstack/store`
- [x] Lucide metadata 的取得方式：SVG 與 tags 來自 `lucide-static`；categories 與改名資訊不在 npm 套件內，改從同版本 tag 的 Lucide repo tarball 讀取（見 `packages/provider-lucide/scripts/generate.ts`）
- [ ] 開放範圍：開放全部 Lucide icon，還是只提供 Dashboard 白名單
- [ ] 最近使用：存在本機，還是存在使用者帳號以便跨裝置同步
- [ ] 是否需要 SSR：會影響 `<Icon />` 首次渲染要不要同步輸出 SVG
- [x] 套件 scope：`@open-tw`
- [x] 發佈位置：公開 npm（`@open-tw` scope，MIT 授權）

## 實作後的決定

第一期實作時，相對於上面規劃的差異與補充：

- **`pascalCodec` 需要傳入對照表**：`pascalCodec({ prefix: 'lucide', names: lucideComponentNames })`。對照表約 78 KB，放在 `@open-tw/icon-provider-lucide/component-names` 獨立子路徑，只有使用 pascal 格式的專案才會打包到。
- **`aria-selected` 依 WAI-ARIA combobox 模式標示鍵盤焦點所在的 option**；資料庫中目前的值另以 `data-current` 標示，`data-active` 方便寫樣式。
- **新增的 options**：`defaultValue`（非受控初始值）、`pageSize`（PageUp/PageDown 的列數，預設 5）、`closeOnSelect`（預設 true）、`id`（a11y id 前綴）。
- **新增的 instance 成員**：`getValue()`、`getSelectedId()`、`getRecentIcons()`、`getItemId()`、`getOptions()`、`setState()`。
- **`onStateChange` 收到的是算好的完整下一個 state**（仍符合 `Updater<IconPickerState>`）。
- **IME**：`handleKeyDown` 在 `isComposing` 時不攔截，避免注音選字時的 Enter 被當成選取。
- **`features` 預設**：search 開、categories 開、recents 關。
- **中文搜尋對照表**：不做。
- **React 同時支援 18 與 19**：只用兩版共通的 API（`useSyncExternalStore`、`useId`、`forwardRef`、`Context.Provider`），不使用 `use()`、ref-as-prop、`<Context value>`。
- **`useIconPicker` 回傳的物件在 state、value、`columns`、`filter` 改變時換新參照**，方法維持穩定。這是為了讓 React Compiler 與 `memo()` 正確重新渲染（`packages/react/test/react-compiler.test.tsx` 以真正的 compiler 驗證）。
- **發佈**：公開 npm、`@open-tw` scope、MIT 授權、ESM only；四個套件以 changesets `fixed` 一起升版。

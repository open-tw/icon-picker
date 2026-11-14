/** Canonical internal icon id: `<prefix>:<name>`, e.g. `lucide:chart-bar`. */
export type IconId = `${string}:${string}`;

export interface IconMeta {
  id: IconId;
  /** Source-library kebab-case name, e.g. `chart-bar`. */
  name: string;
  /** Display name (can be localised). */
  label?: string;
  /** Search keywords. */
  tags: string[];
  categories: string[];
}

export interface IconData extends IconMeta {
  /** Inner markup of the `<svg>` element (no outer `<svg>` tag). */
  body: string;
  /** viewBox width / height. */
  width: number;
  height: number;
  style: 'stroke' | 'fill';
}

export interface IconProvider {
  /** Id prefix, e.g. `lucide`. */
  prefix: string;
  /** Human readable library name, e.g. `Lucide`. */
  label: string;
  /** Metadata for listing and searching. */
  loadMeta(): Promise<IconMeta[]>;
  /** Batch-load SVG bodies. Unknown names are simply omitted from the result. */
  loadIcons(names: string[]): Promise<IconData[]>;
  /** Old name → current name. Applied before every lookup. */
  aliases?: Record<string, string>;
  /** Category id → display label. */
  categoryLabels?: Record<string, string>;
}

export interface IconValueCodec<T = string> {
  /** Stored value → internal id. Return `null` for values that cannot be mapped. */
  parse(value: T): IconId | null;
  /** Internal id → stored value. */
  format(id: IconId): T;
}

export interface IconRegistry<T = string> {
  getProviders(): readonly IconProvider[];
  getProvider(prefix: string): IconProvider | undefined;
  loadMeta(prefix?: string): Promise<IconMeta[]>;
  resolve(id: IconId): Promise<IconData | null>;
  resolveMany(ids: readonly IconId[]): Promise<Map<IconId, IconData>>;
  /** Synchronous cache read, for renderers. */
  getCached(id: IconId): IconData | undefined;
  /** Applies aliases and checks the provider exists. Returns `null` for unknown prefixes / malformed ids. */
  normalize(id: string): IconId | null;
  /** Stored value → internal id (through the codec). */
  parse(value: T | null | undefined): IconId | null;
  /** Internal id → stored value (through the codec). */
  format(id: IconId): T;
}

export type Updater<T> = T | ((old: T) => T);

export interface RecentsStorage {
  get(): IconId[] | Promise<IconId[]>;
  set(ids: IconId[]): void | Promise<void>;
}

export type IconPickerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface IconPickerState {
  open: boolean;
  query: string;
  category: string | null;
  /** Provider prefix currently browsed; `null` = all providers. */
  provider: string | null;
  /** Index into `getFilteredIcons()` that has keyboard focus. */
  activeIndex: number;
  recents: IconId[];
  status: IconPickerStatus;
}

export type SearchField = 'name' | 'tags' | 'label';

export interface IconPickerFeatures {
  search?: boolean | { fields?: SearchField[] };
  categories?: boolean;
  recents?: boolean | { max?: number; storage?: RecentsStorage };
}

export interface IconPickerMessages {
  searchLabel: string;
  gridLabel: string;
  loading: string;
  error: string;
  noResults: string;
  results: (count: number) => string;
  iconLabel: (icon: IconMeta) => string;
}

export interface IconPickerOptions<T = string> {
  registry: IconRegistry<T>;
  /** Controlled selected value (stored format). `undefined` = uncontrolled. */
  value?: T | null;
  /** Initial value when uncontrolled. */
  defaultValue?: T | null;
  /** Receives the stored format. */
  onChange?: (value: T | null) => void;
  initialState?: Partial<IconPickerState>;
  /** Partially controlled state. */
  state?: Partial<IconPickerState>;
  onStateChange?: (updater: Updater<IconPickerState>) => void;
  features?: IconPickerFeatures;
  /** Grid columns, used for keyboard navigation and `getRows()`. */
  columns?: number;
  /** Visible rows; PageUp / PageDown move by this many rows. Default 5. */
  pageSize?: number;
  /** Close after `select()`. Default true. */
  closeOnSelect?: boolean;
  /** Allow / deny list. */
  filter?: (icon: IconMeta) => boolean;
  messages?: Partial<IconPickerMessages>;
  /** Base for generated DOM ids. Defaults to an auto-incremented id. */
  id?: string;
}

/** Framework-agnostic subset of a keyboard event. Works with DOM and React events. */
export interface KeyboardEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
  preventDefault?: () => void;
}

export type MoveDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'rowStart'
  | 'rowEnd'
  | 'first'
  | 'last'
  | 'pageUp'
  | 'pageDown';

export type A11yProps = Record<string, string | number | boolean | undefined>;

export interface CategoryItem {
  id: string;
  label: string;
  count: number;
}

export interface IconPicker<T = string> {
  // state
  getState(): IconPickerState;
  getOptions(): IconPickerOptions<T>;
  setOptions(next: Updater<IconPickerOptions<T>>): void;
  setState(updater: Updater<IconPickerState>): void;
  subscribe(listener: () => void): () => void;
  // value
  getValue(): T | null;
  getSelectedId(): IconId | null;
  // derived
  getFilteredIcons(): IconMeta[];
  getRows(): IconMeta[][];
  getCategories(): CategoryItem[];
  getProviders(): readonly IconProvider[];
  getActiveIcon(): IconMeta | null;
  getSelectedIcon(): IconMeta | null;
  getRecentIcons(): IconMeta[];
  // actions
  setQuery(query: string): void;
  setCategory(category: string | null): void;
  setProvider(prefix: string | null): void;
  setActiveIndex(index: number): void;
  select(id: IconId): void;
  clear(): void;
  open(): void;
  close(): void;
  toggle(): void;
  // keyboard
  moveActive(direction: MoveDirection): void;
  handleKeyDown(event: KeyboardEventLike): boolean;
  // a11y
  getSearchA11y(): A11yProps;
  getGridA11y(): A11yProps;
  getItemA11y(icon: IconMeta): A11yProps;
  getItemId(icon: IconMeta): string;
  getAnnouncement(): string;
  // loading / lifecycle
  load(): Promise<void>;
  mount(): () => void;
}

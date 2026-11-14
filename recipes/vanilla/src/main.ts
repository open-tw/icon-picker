import {
  createIconRegistry,
  kebabCodec,
  messagesZhTW,
  pascalCodec,
  prefixedCodec,
  type IconRegistry,
  type IconValueCodec,
} from '@open-tw/icon-picker-core';
import { localStorageRecents, mountIconValue } from '@open-tw/icon-picker-dom';
import { LUCIDE_VERSION, lucide } from '@open-tw/icon-provider-lucide';
import { lucideComponentNames } from '@open-tw/icon-provider-lucide/component-names';
import { createIconField, type IconField } from './icon-field';
import './style.css';

// ------------------------------------------------------------------ "database"
type CodecKind = 'prefixed' | 'pascal' | 'kebab';

interface Widget {
  id: string;
  title: string;
  icon: string | null; // stored format depends on the codec
}

const codecs: Record<CodecKind, () => IconValueCodec<string>> = {
  prefixed: () => prefixedCodec(),
  pascal: () => pascalCodec({ prefix: 'lucide', names: lucideComponentNames }),
  kebab: () => kebabCodec({ prefix: 'lucide' }),
};

let codecKind: CodecKind = 'prefixed';
let widgets: Widget[] = [
  { id: 'w1', title: '營收', icon: 'lucide:chart-bar' },
  { id: 'w2', title: '活躍使用者', icon: 'lucide:users' },
  // Renamed in Lucide — resolved through aliases.
  { id: 'w3', title: '轉換率', icon: 'lucide:bar-chart-horizontal' },
  { id: 'w4', title: '未設定', icon: null },
];
let selectedWidgetId = 'w1';

const log = (msg: string) => {
  const el = document.querySelector<HTMLElement>('#log')!;
  el.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n${el.textContent ?? ''}`.slice(0, 2000);
};

function makeRegistry(kind: CodecKind): IconRegistry<string> {
  return createIconRegistry({
    providers: [lucide],
    codec: codecs[kind](),
    onInvalidValue: value => log(`無法解析的值：${JSON.stringify(value)}`),
  });
}

let registry = makeRegistry(codecKind);
let field: IconField<string> | null = null;

// ------------------------------------------------------------------ UI

const cardsEl = document.querySelector<HTMLElement>('#widgets')!;
const fieldEl = document.querySelector<HTMLElement>('#icon-field')!;
const dbEl = document.querySelector<HTMLElement>('#db')!;
const codecSelect = document.querySelector<HTMLSelectElement>('#codec')!;
const editingEl = document.querySelector<HTMLElement>('#editing')!;
document.querySelector('#lucide-version')!.textContent = LUCIDE_VERSION;

function renderWidgets() {
  cardsEl.replaceChildren(
    ...widgets.map(w => {
      const icon = document.createElement('span');
      icon.className = 'card-icon';
      void mountIconValue(icon, w.icon, { registry, size: 28 });
      const title = document.createElement('span');
      title.className = 'card-title';
      title.textContent = w.title;
      const value = document.createElement('code');
      value.textContent = JSON.stringify(w.icon);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-pressed', String(w.id === selectedWidgetId));
      card.append(icon, title, value);
      card.addEventListener('click', () => {
        selectedWidgetId = w.id;
        renderWidgets();
        field?.setValue(currentWidget().icon);
      });
      return card;
    }),
  );
  dbEl.textContent = JSON.stringify(widgets, null, 2);
  editingEl.textContent = currentWidget().title;
}

const currentWidget = () => widgets.find(w => w.id === selectedWidgetId)!;

function mountField() {
  field?.destroy();
  field = createIconField<string>(fieldEl, {
    registry,
    value: currentWidget().icon,
    onChange: value => {
      widgets = widgets.map(w => (w.id === selectedWidgetId ? { ...w, icon: value } : w));
      // Controlled value: feed it back before the picker notifies.
      field?.picker.setOptions(o => ({ ...o, value }));
      log(`onChange → ${JSON.stringify(value)}`);
      renderWidgets();
    },
    columns: 8,
    pageSize: 8,
    placeholderIcon: 'lucide:image',
    features: { search: true, categories: true, recents: { max: 16, storage: localStorageRecents('demo:icon-recents') } },
    messages: messagesZhTW,
    text: {
      trigger: '選擇 icon',
      searchPlaceholder: '搜尋（英文名稱或關鍵字）',
      allCategories: '全部分類',
      allProviders: '全部 icon 庫',
      recents: '最近使用',
      clear: '清除',
    },
  });
}

codecSelect.addEventListener('change', () => {
  const next = codecSelect.value as CodecKind;
  // Migration: parse with the old codec, format with the new one.
  const nextRegistry = makeRegistry(next);
  widgets = widgets.map(w => {
    const id = registry.parse(w.icon);
    return { ...w, icon: id ? nextRegistry.format(id) : null };
  });
  log(`codec: ${codecKind} → ${next}（已轉換既有資料）`);
  codecKind = next;
  registry = nextRegistry;
  renderWidgets();
  mountField();
});

renderWidgets();
mountField();

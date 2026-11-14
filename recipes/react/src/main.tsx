import {
  createIconRegistry,
  kebabCodec,
  messagesZhTW,
  pascalCodec,
  prefixedCodec,
  type IconRegistry,
  type IconValueCodec,
} from '@open-tw/icon-picker-core';
import { localStorageRecents } from '@open-tw/icon-picker-dom';
import { Icon, IconRegistryProvider } from '@open-tw/icon-picker-react';
import { LUCIDE_VERSION, lucide } from '@open-tw/icon-provider-lucide';
import { lucideComponentNames } from '@open-tw/icon-provider-lucide/component-names';
import { StrictMode, useMemo, useState, version as reactVersion } from 'react';
import { createRoot } from 'react-dom/client';
import { IconField } from './IconField';
import './style.css';

type CodecKind = 'prefixed' | 'pascal' | 'kebab';

interface Widget {
  id: string;
  title: string;
  icon: string | null;
}

const codecs: Record<CodecKind, () => IconValueCodec<string>> = {
  prefixed: () => prefixedCodec(),
  pascal: () => pascalCodec({ prefix: 'lucide', names: lucideComponentNames }),
  kebab: () => kebabCodec({ prefix: 'lucide' }),
};

const makeRegistry = (kind: CodecKind, log: (msg: string) => void): IconRegistry<string> =>
  createIconRegistry({
    providers: [lucide],
    codec: codecs[kind](),
    onInvalidValue: value => log(`無法解析的值：${JSON.stringify(value)}`),
  });

const features = { search: true, categories: true, recents: { max: 16, storage: localStorageRecents('demo:icon-recents') } };
const text = {
  trigger: '選擇 icon',
  searchPlaceholder: '搜尋（英文名稱或關鍵字）',
  allCategories: '全部分類',
  recents: '最近使用',
  clear: '清除',
};

function App() {
  const [logLines, setLog] = useState<string[]>([]);
  const log = (msg: string) => setLog(l => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 50));
  const [codecKind, setCodecKind] = useState<CodecKind>('prefixed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const registry = useMemo(() => makeRegistry(codecKind, log), [codecKind]);
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: 'w1', title: '營收', icon: 'lucide:chart-bar' },
    { id: 'w2', title: '活躍使用者', icon: 'lucide:users' },
    { id: 'w3', title: '轉換率', icon: 'lucide:bar-chart-horizontal' }, // renamed → alias
    { id: 'w4', title: '未設定', icon: null },
  ]);
  const [selectedId, setSelectedId] = useState('w1');
  const current = widgets.find(w => w.id === selectedId)!;

  const changeCodec = (next: CodecKind) => {
    // Migration: parse with the old codec, format with the new one.
    const nextRegistry = makeRegistry(next, log);
    setWidgets(ws =>
      ws.map(w => {
        const id = registry.parse(w.icon);
        return { ...w, icon: id ? nextRegistry.format(id) : null };
      }),
    );
    log(`codec: ${codecKind} → ${next}（已轉換既有資料）`);
    setCodecKind(next);
  };

  return (
    <IconRegistryProvider value={registry}>
      <main>
        <header>
          <h1>Headless Icon Picker — React recipe</h1>
          <p>
            <code>@open-tw/icon-picker-react</code> + <code>@tanstack/react-virtual</code>，React {reactVersion}，Lucide{' '}
            {LUCIDE_VERSION}
          </p>
        </header>

        <section className="panel">
          <div className="row">
            <label>
              儲存格式（codec）
              <select value={codecKind} onChange={e => changeCodec(e.target.value as CodecKind)}>
                <option value="prefixed">prefixedCodec() → lucide:chart-bar</option>
                <option value="pascal">pascalCodec() → ChartBar</option>
                <option value="kebab">kebabCodec() → chart-bar</option>
              </select>
            </label>
          </div>
          <h2>Dashboard 小工具</h2>
          <div className="cards">
            {widgets.map(w => (
              <button
                key={w.id}
                type="button"
                className="card"
                aria-pressed={w.id === selectedId}
                onClick={() => setSelectedId(w.id)}
              >
                <span className="card-icon">
                  {/* Stored value straight from the "DB" column. */}
                  <Icon value={w.icon} size={28} />
                </span>
                <span className="card-title">{w.title}</span>
                <code>{JSON.stringify(w.icon)}</code>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>編輯「{current.title}」的 icon</h2>
          {/* key: a new codec means a new registry → new picker instance. */}
          <IconField
            key={codecKind}
            value={current.icon}
            onChange={value => {
              setWidgets(ws => ws.map(w => (w.id === selectedId ? { ...w, icon: value } : w)));
              log(`onChange → ${JSON.stringify(value)}`);
            }}
            features={features}
            messages={messagesZhTW}
            text={text}
          />
          <p className="hint">
            ↑↓←→ 移動、Home/End 列首列尾、Ctrl+Home/End 全部首尾、PageUp/PageDown 翻頁、Enter 選取、Esc 清空搜尋／關閉
          </p>
        </section>

        <section className="panel two">
          <div>
            <h2>資料庫內容</h2>
            <pre>{JSON.stringify(widgets, null, 2)}</pre>
          </div>
          <div>
            <h2>事件</h2>
            <pre>{logLines.join('\n')}</pre>
          </div>
        </section>
      </main>
    </IconRegistryProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

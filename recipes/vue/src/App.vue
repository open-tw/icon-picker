<script setup lang="ts">
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
import { Icon, provideIconRegistry } from '@open-tw/icon-picker-vue';
import { LUCIDE_VERSION, lucide } from '@open-tw/icon-provider-lucide';
import { lucideComponentNames } from '@open-tw/icon-provider-lucide/component-names';
import { computed, ref, shallowRef, version as vueVersion } from 'vue';
import IconField from './IconField.vue';

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

const logLines = ref<string[]>([]);
const log = (msg: string) => {
  logLines.value = [`${new Date().toLocaleTimeString()}  ${msg}`, ...logLines.value].slice(0, 50);
};

const makeRegistry = (kind: CodecKind): IconRegistry<string> =>
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

const codecKind = ref<CodecKind>('prefixed');
const registry = shallowRef(makeRegistry(codecKind.value));
// A ref: swapping the registry updates every <Icon> below.
provideIconRegistry(registry);

const widgets = ref<Widget[]>([
  { id: 'w1', title: '營收', icon: 'lucide:chart-bar' },
  { id: 'w2', title: '活躍使用者', icon: 'lucide:users' },
  { id: 'w3', title: '轉換率', icon: 'lucide:bar-chart-horizontal' }, // renamed → alias
  { id: 'w4', title: '未設定', icon: null },
]);
const selectedId = ref('w1');
const current = computed(() => widgets.value.find(w => w.id === selectedId.value)!);

const currentIcon = computed({
  get: () => current.value.icon,
  set: value => {
    current.value.icon = value;
    log(`onChange → ${JSON.stringify(value)}`);
  },
});

function changeCodec(next: CodecKind) {
  // Migration: parse with the old codec, format with the new one.
  const nextRegistry = makeRegistry(next);
  for (const w of widgets.value) {
    const id = registry.value.parse(w.icon);
    w.icon = id ? nextRegistry.format(id) : null;
  }
  log(`codec: ${codecKind.value} → ${next}（已轉換既有資料）`);
  codecKind.value = next;
  registry.value = nextRegistry;
}
</script>

<template>
  <main>
    <header>
      <h1>Headless Icon Picker — Vue recipe</h1>
      <p>
        <code>@open-tw/icon-picker-vue</code> + <code>@tanstack/vue-virtual</code>，Vue {{ vueVersion }}，Lucide
        {{ LUCIDE_VERSION }}
      </p>
    </header>

    <section class="panel">
      <div class="row">
        <label>
          儲存格式（codec）
          <select :value="codecKind" @change="changeCodec(($event.target as HTMLSelectElement).value as CodecKind)">
            <option value="prefixed">prefixedCodec() → lucide:chart-bar</option>
            <option value="pascal">pascalCodec() → ChartBar</option>
            <option value="kebab">kebabCodec() → chart-bar</option>
          </select>
        </label>
      </div>
      <h2>Dashboard 小工具</h2>
      <div class="cards">
        <button
          v-for="w in widgets"
          :key="w.id"
          type="button"
          class="card"
          :aria-pressed="w.id === selectedId"
          @click="selectedId = w.id"
        >
          <span class="card-icon">
            <!-- Stored value straight from the "DB" column. -->
            <Icon :value="w.icon" :size="28" />
          </span>
          <span class="card-title">{{ w.title }}</span>
          <code>{{ JSON.stringify(w.icon) }}</code>
        </button>
      </div>
    </section>

    <section class="panel">
      <h2>編輯「{{ current.title }}」的 icon</h2>
      <!-- key: a new codec means a new registry → new picker instance. -->
      <IconField :key="codecKind" v-model="currentIcon" :features="features" :messages="messagesZhTW" :text="text" />
      <p class="hint">
        ↑↓←→ 移動、Home/End 列首列尾、Ctrl+Home/End 全部首尾、PageUp/PageDown 翻頁、Enter 選取、Esc 清空搜尋／關閉
      </p>
    </section>

    <section class="panel two">
      <div>
        <h2>資料庫內容</h2>
        <pre>{{ JSON.stringify(widgets, null, 2) }}</pre>
      </div>
      <div>
        <h2>事件</h2>
        <pre>{{ logLines.join('\n') }}</pre>
      </div>
    </section>
  </main>
</template>

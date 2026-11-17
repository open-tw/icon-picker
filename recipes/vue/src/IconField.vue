<!--
  Unstyled reference UI for Vue 3 (recipe — copy into your project and adapt, e.g. swap in Vuetify / PrimeVue parts).

  - Behaviour, state and a11y attributes come from `useIconPicker()`
  - The grid is virtualised with `@tanstack/vue-virtual` using `picker.getRows()`
  - Only structural class names (`ip-*`) are emitted
  - Works with `v-model`
-->
<script setup lang="ts">
import type { IconId, IconPickerFeatures, IconPickerMessages } from '@open-tw/icon-picker-core';
import { Icon, useIconPicker, useIconRegistry } from '@open-tw/icon-picker-vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

export interface IconFieldText {
  trigger: string;
  searchPlaceholder: string;
  allCategories: string;
  recents: string;
  clear: string;
}

const props = withDefaults(
  defineProps<{
    columns?: number;
    /** Must match your CSS. */
    rowHeight?: number;
    features?: IconPickerFeatures;
    messages?: Partial<IconPickerMessages>;
    placeholderIcon?: IconId;
    text: IconFieldText;
  }>(),
  { columns: 8, rowHeight: 40, placeholderIcon: 'lucide:image' },
);

const model = defineModel<string | null>({ default: null });

const registry = useIconRegistry();
const picker = useIconPicker(() => ({
  registry,
  value: model.value,
  onChange: v => (model.value = v),
  columns: props.columns,
  pageSize: 8,
  features: props.features,
  messages: props.messages,
}));

const state = computed(() => picker.getState());
const rows = computed(() => picker.getRows());
const selectedId = computed(() => picker.getSelectedId());

const root = useTemplateRef<HTMLDivElement>('root');
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const input = useTemplateRef<HTMLInputElement>('input');
const scroller = useTemplateRef<HTMLDivElement>('scroller');

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => props.rowHeight,
    overscan: 4,
  })),
);

// Focus the search box on open; give focus back to the trigger when closing from inside the popover
// (select / Escape). The popover is already gone when this runs, so focus is tracked in a flag.
const focusInPopover = ref(false);
watch(
  () => state.value.open,
  (open, wasOpen) => {
    if (open && !wasOpen) input.value?.focus();
    if (!open && wasOpen && focusInPopover.value) trigger.value?.focus();
    if (!open) focusInPopover.value = false;
  },
  { flush: 'post' },
);

// Keep the keyboard-active row visible.
watch(
  () => [state.value.open, state.value.activeIndex, props.columns, rows.value.length] as const,
  async ([open, activeIndex, columns, count]) => {
    if (!open || !count) return;
    await nextTick();
    virtualizer.value.scrollToIndex(Math.floor(activeIndex / columns), { align: 'auto' });
  },
);

// Close on outside click.
watch(
  () => state.value.open,
  (open, _, onCleanup) => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.value?.contains(e.target as Node)) {
        focusInPopover.value = false; // the user is moving focus elsewhere
        picker.close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    onCleanup(() => document.removeEventListener('pointerdown', onPointerDown));
  },
);

function onPopoverKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && e.target !== input.value) picker.close();
}
</script>

<template>
  <div ref="root" class="ip">
    <button
      ref="trigger"
      type="button"
      class="ip-trigger"
      aria-haspopup="listbox"
      :aria-expanded="state.open"
      @click="picker.toggle"
      @pointerenter="picker.load()"
      @focus="picker.load()"
    >
      <!-- Preload on intent (pointerenter / focus) so the first open is instant. -->
      <span class="ip-trigger-icon">
        <Icon :id="selectedId ?? placeholderIcon" />
      </span>
      <span class="ip-trigger-text">{{ selectedId ?? text.trigger }}</span>
    </button>

    <div v-if="state.open" class="ip-popover" @focusin="focusInPopover = true" @keydown="onPopoverKeyDown">
      <div class="ip-toolbar">
        <input
          ref="input"
          class="ip-search"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="text.searchPlaceholder"
          :value="state.query"
          v-bind="picker.getSearchA11y()"
          @input="picker.setQuery(($event.target as HTMLInputElement).value)"
          @keydown="picker.handleKeyDown"
        />
        <select
          v-if="picker.getCategories().length > 0"
          class="ip-category"
          :aria-label="text.allCategories"
          :value="state.category ?? ''"
          @change="picker.setCategory(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">{{ text.allCategories }}</option>
          <option v-for="c in picker.getCategories()" :key="c.id" :value="c.id">{{ c.label }} ({{ c.count }})</option>
        </select>
        <button type="button" class="ip-clear" @click="picker.clear">{{ text.clear }}</button>
      </div>

      <div
        v-if="picker.getRecentIcons().length > 0 && !state.query && !state.category"
        class="ip-recents"
        role="group"
        :aria-label="text.recents"
      >
        <div class="ip-recents-label">{{ text.recents }}</div>
        <div class="ip-recents-list">
          <button
            v-for="icon in picker.getRecentIcons()"
            :key="icon.id"
            type="button"
            class="ip-recent"
            :title="icon.name"
            :aria-label="icon.name"
            @mousedown.prevent
            @click="picker.select(icon.id)"
          >
            <Icon :id="icon.id" />
          </button>
        </div>
      </div>

      <div ref="scroller" class="ip-grid" style="overflow-y: auto" v-bind="picker.getGridA11y()">
        <div class="ip-sizer" :style="{ position: 'relative', width: '100%', height: `${virtualizer.getTotalSize()}px` }">
          <div
            v-for="item in virtualizer.getVirtualItems()"
            :key="String(item.key)"
            class="ip-row"
            role="presentation"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }"
          >
            <!-- Combobox pattern: focus stays in the search box (mousedown.prevent, tabindex -1). -->
            <button
              v-for="icon in rows[item.index]"
              :key="icon.id"
              type="button"
              class="ip-option"
              tabindex="-1"
              :title="icon.name"
              v-bind="picker.getItemA11y(icon)"
              @mousedown.prevent
              @click="picker.select(icon.id)"
            >
              <Icon :id="icon.id" />
            </button>
          </div>
        </div>
      </div>

      <div class="ip-status" aria-live="polite" aria-atomic="true">{{ picker.getAnnouncement() }}</div>
    </div>
  </div>
</template>

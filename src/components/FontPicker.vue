<script setup lang="ts">
import { computed } from 'vue'
import { FontPickerRoot } from '@inkly/vue'

import { useSelectUI } from '@/components/ui/select'
import { usePopoverUI } from '@/components/ui/popover'
import {
  listFamilies,
  loadFont,
  localFontAccessState,
  requestLocalFontAccess
} from '@/app/editor/fonts'

import type { FontPickerUi } from '@inkly/vue'

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const cls = usePopoverUI({
  content: 'w-[var(--reka-combobox-trigger-width)] min-w-56 overflow-hidden p-0'
})
const selectCls = useSelectUI({
  trigger: 'w-full rounded px-2 py-1 text-xs',
  item: 'w-full gap-2 px-3 py-2.5 text-sm leading-tight'
})

const ui = computed<FontPickerUi>(() => ({
  trigger: selectCls.trigger,
  content: cls.content,
  item: selectCls.item,
  search:
    'w-full border-b border-border bg-transparent px-3 py-2 text-sm text-surface outline-none placeholder:text-muted',
  empty: 'px-2 py-3 text-center text-xs text-muted',
  emptyAction: 'mt-2 rounded bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50'
}))

const previewFontLoads = new Set<string>()

const localFontAccess = {
  state: localFontAccessState,
  load: requestLocalFontAccess
}

function loadPreviewFont(family: string, source: string) {
  if (source !== 'google') return
  if (previewFontLoads.has(family)) return
  previewFontLoads.add(family)
  void loadFont(family)
}
</script>

<template>
  <FontPickerRoot
    v-model="modelValue"
    data-test-id="font-picker-root"
    :list-families="listFamilies"
    :local-font-access="localFontAccess"
    :ui="ui"
    empty-fonts-hint="Use the desktop app or Chrome/Edge to access system fonts."
    @select="emit('select', $event)"
  >
    <template #trigger>
      <button data-test-id="font-picker-trigger" :class="selectCls.trigger">
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </template>

    <template #item="{ family, selected, source }">
      <div
        data-test-id="font-picker-item"
        class="flex min-w-0 flex-1 items-center gap-2"
        @vue:mounted="loadPreviewFont(family, source)"
      >
        <icon-lucide-check v-if="selected" class="size-3 shrink-0 text-accent" />
        <span v-else class="size-3 shrink-0" />
        <span class="truncate" :style="{ fontFamily: `'${family}', sans-serif` }">{{
          family
        }}</span>
        <span
          class="font-sans ml-auto shrink-0 rounded bg-input px-1.5 py-0.5 text-[9px] uppercase text-muted"
        >
          {{ source }}
        </span>
      </div>
    </template>
  </FontPickerRoot>
</template>

<script setup lang="ts">
import { FontPickerRoot } from '@open-pencil/vue'

import { useSelectUI } from '@/components/ui/select'
import { usePopoverUI } from '@/components/ui/popover'
import { listFamilies } from '@/app/editor/fonts'

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const cls = usePopoverUI({
  content: 'w-[var(--reka-combobox-trigger-width)] min-w-56 overflow-hidden p-0'
})
const selectCls = useSelectUI({
  trigger: 'w-full rounded px-2 py-1 text-xs',
  item: 'w-full gap-2 px-2 py-2 text-sm'
})
</script>

<template>
  <FontPickerRoot
    v-model="modelValue"
    data-test-id="font-picker-root"
    :list-families="listFamilies"
    :trigger-class="selectCls.trigger"
    :content-class="cls.content"
    item-class=""
    search-class="min-w-0 flex-1 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
    empty-class="px-2 py-3 text-center text-xs text-muted"
    empty-fonts-hint="Use the desktop app or Chrome/Edge to access system fonts."
    @select="emit('select', $event)"
  >
    <template #trigger>
      <button data-test-id="font-picker-trigger" :class="selectCls.trigger">
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </template>

    <template #search>
      <div class="flex items-center gap-1 border-b border-border px-2 py-1">
        <icon-lucide-search class="size-3 shrink-0 text-muted" />
        <input
          class="min-w-0 flex-1 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
          placeholder="Search fonts…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </div>
    </template>

    <template #item="{ family, selected }">
      <div
        data-test-id="font-picker-item"
        :class="selectCls.item"
        :style="{ fontFamily: `'${family}', sans-serif` }"
      >
        <icon-lucide-check v-if="selected" class="size-3 shrink-0 text-accent" />
        <span v-else class="size-3 shrink-0" />
        <span class="truncate">{{ family }}</span>
      </div>
    </template>
  </FontPickerRoot>
</template>

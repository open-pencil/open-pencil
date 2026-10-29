<script setup lang="ts">
import IconButton from '@/components/ui/button/IconButton.vue'

import { useTableUI, type TableUI } from './ui'

/** Where a page sits among a table's rows, and the buttons to the pages either side. */
const { range, canPrevious, canNext, previousLabel, nextLabel, ui } = defineProps<{
  /** Which rows the page shows of how many, such as “51–100 of 230”. */
  range: string
  canPrevious: boolean
  canNext: boolean
  previousLabel: string
  nextLabel: string
  ui?: TableUI
}>()
const emit = defineEmits<{ previous: []; next: [] }>()
const cls = useTableUI(ui)
</script>

<template>
  <div data-slot="table-pagination" :class="cls.pagination">
    <span :class="cls.range">{{ range }}</span>
    <div :class="cls.pages">
      <IconButton :label="previousLabel" :disabled="!canPrevious" @click="emit('previous')">
        <icon-lucide-chevron-left class="size-3.5" />
      </IconButton>
      <IconButton :label="nextLabel" :disabled="!canNext" @click="emit('next')">
        <icon-lucide-chevron-right class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>

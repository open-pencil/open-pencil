<script setup lang="ts">
import AppProgress from '@/components/ui/feedback/AppProgress.vue'
import { skeleton } from '@/components/ui/feedback/skeleton'

import { useTableUI, type TableUI } from './ui'

/**
 * The frame of a table: it scrolls sideways when its columns do not fit, holds a footer such as
 * the pages under the rows, and while newer rows load shows a pulsing bar along its top edge.
 */
const {
  label,
  loading = false,
  loadingLabel,
  ui
} = defineProps<{
  /** What the table lists, for assistive technology. */
  label: string
  /** `first` before any rows have loaded, `refresh` while newer rows replace the shown ones. */
  loading?: 'first' | 'refresh' | false
  /** What assistive technology announces while the table loads, such as “Loading…”. */
  loadingLabel?: string
  ui?: TableUI
}>()
const cls = useTableUI(ui)
const placeholders = skeleton()
</script>

<template>
  <div data-slot="table" :class="cls.root">
    <!-- The placeholders and the bar are for the eye; this says it to assistive technology, from
         outside the busy table so it is announced when loading starts. -->
    <span v-if="loadingLabel" role="status" class="sr-only">{{ loading ? loadingLabel : '' }}</span>
    <div
      v-if="loading === 'refresh'"
      :class="[cls.refresh, placeholders.group()]"
      aria-hidden="true"
    >
      <AppProgress :amount="{}" :ui="{ track: 'h-0.5 rounded-none bg-transparent' }" />
    </div>
    <div :class="cls.scroller">
      <table :class="cls.table" :aria-label="label" :aria-busy="loading ? true : undefined">
        <slot />
      </table>
    </div>
    <div v-if="$slots.footer" data-slot="table-footer" :class="cls.footer">
      <slot name="footer" />
    </div>
  </div>
</template>

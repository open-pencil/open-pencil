<script setup lang="ts">
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import { skeleton } from '@/components/ui/feedback/skeleton'

import AppTableCell from './AppTableCell.vue'
import AppTableRow from './AppTableRow.vue'
import { useTableUI, type TableUI } from './ui'

/** How many rows of placeholders stand in for rows that have not loaded. */
const PLACEHOLDER_ROWS = 5

/**
 * Rows of grey bars in the table's own columns, before its first rows load; they fade in after a
 * moment so rows that arrive quickly replace nothing. The first column names a row, so it gets the
 * longer bar, and a column of actions gets none.
 */
const { columns, ui } = defineProps<{
  columns: readonly { id: string; class?: string; actions?: boolean }[]
  ui?: TableUI
}>()
const cls = useTableUI(ui)
const placeholders = skeleton()
</script>

<template>
  <tbody data-slot="table-placeholder" :class="[cls.body, placeholders.group()]">
    <AppTableRow v-for="row in PLACEHOLDER_ROWS" :key="row">
      <AppTableCell v-for="(column, index) in columns" :key="column.id" :class="column.class">
        <AppSkeleton
          v-if="!column.actions"
          :class="index === 0 ? 'w-40 max-w-full' : 'w-16 max-w-full'"
        />
      </AppTableCell>
    </AppTableRow>
  </tbody>
</template>

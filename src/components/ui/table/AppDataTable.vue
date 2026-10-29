<script setup lang="ts" generic="Features extends TableFeatures, Row extends RowData">
import { FlexRender, type RowData, type Table, type TableFeatures } from '@tanstack/vue-table'
import { computed } from 'vue'

import AppTable from './AppTable.vue'
import AppTableBody from './AppTableBody.vue'
import AppTableCell from './AppTableCell.vue'
import AppTableEmpty from './AppTableEmpty.vue'
import AppTableHead from './AppTableHead.vue'
import AppTableHeader from './AppTableHeader.vue'
import AppTablePlaceholder from './AppTablePlaceholder.vue'
import AppTableRow from './AppTableRow.vue'
import { tableColumnMeta } from './columns'

/**
 * A TanStack table drawn with the table parts: each column renders its own header and cells, and
 * its `meta` (`TableColumnMeta`) gives their classes; `hidden` leaves columns out. Before its first
 * rows load it shows placeholders in its columns, and while newer rows load it keeps the old ones.
 */
const {
  table,
  label,
  hidden = [],
  loading = false,
  loadingLabel
} = defineProps<{
  table: Table<Features, Row>
  /** What the table lists, for assistive technology. */
  label: string
  hidden?: readonly string[]
  loading?: 'first' | 'refresh' | false
  /** What assistive technology announces while the table loads, such as “Loading…”. */
  loadingLabel?: string
}>()
defineSlots<{ empty?: () => unknown; footer?: () => unknown }>()

const shown = (column: { id: string }) => !hidden.includes(column.id)
const headers = computed(() =>
  table.getHeaderGroups().map((group) => ({
    id: group.id,
    headers: group.headers.filter((header) => shown(header.column))
  }))
)
const rows = computed(() =>
  table.getRowModel().rows.map((row) => ({
    row,
    cells: row.getAllCells().filter((cell) => shown(cell.column))
  }))
)
const columns = computed(() =>
  (headers.value.at(-1)?.headers ?? []).map((header) => {
    const meta = tableColumnMeta(header.column.columnDef.meta)
    return { id: header.column.id, class: meta.class, actions: meta.actions }
  })
)
</script>

<template>
  <AppTable :label="label" :loading="loading" :loading-label="loadingLabel">
    <AppTableHeader>
      <AppTableRow v-for="group in headers" :key="group.id">
        <AppTableHead
          v-for="header in group.headers"
          :key="header.id"
          :colspan="header.colSpan"
          :label-hidden="tableColumnMeta(header.column.columnDef.meta).actions"
          :class="tableColumnMeta(header.column.columnDef.meta).class"
        >
          <FlexRender v-if="!header.isPlaceholder" :header="header" />
        </AppTableHead>
      </AppTableRow>
    </AppTableHeader>
    <AppTablePlaceholder v-if="loading === 'first'" :columns="columns" />
    <AppTableBody v-else :refreshing="loading === 'refresh'">
      <AppTableRow v-for="{ row, cells } in rows" :key="row.id">
        <AppTableCell
          v-for="cell in cells"
          :key="cell.id"
          :class="tableColumnMeta(cell.column.columnDef.meta).class"
        >
          <FlexRender :cell="cell" />
        </AppTableCell>
      </AppTableRow>
      <AppTableEmpty v-if="!rows.length && $slots.empty" :colspan="columns.length || 1">
        <slot name="empty" />
      </AppTableEmpty>
    </AppTableBody>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </AppTable>
</template>

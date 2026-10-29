<script setup lang="ts" generic="Filter extends string, Row extends RowData">
import type { RowData } from '@tanstack/vue-table'
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import type { PortalList } from '@/app/cloud-portal/list'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'
import AppTablePagination from '@/components/ui/table/AppTablePagination.vue'

import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import { portalTable } from './ui'

/**
 * A console list the server searches, filters, and pages: a search box when `searchLabel` is
 * given, the filters with how many rows each holds, the table its columns draw, and the pages.
 */
const {
  list,
  label,
  searchLabel,
  filters = [],
  hidden = [],
  emptyLabel,
  emptyDescription
} = defineProps<{
  list: PortalList<Filter, Row>
  label: string
  searchLabel?: string
  filters?: { value: Filter; label: string }[]
  hidden?: readonly string[]
  emptyLabel: string
  emptyDescription?: string
}>()
defineSlots<{ icon?: () => unknown }>()

const ui = portalTable()
const messages = useCloudPortalMessages()
const { table, query, filter, counts, range, total, status, error, reload } = list
/** What the table shows while the server answers. */
const loading = computed(() => {
  if (status.value === 'loading') return 'first'
  return status.value === 'refreshing' ? 'refresh' : false
})
const filterOf = (value: string) => filters.find((option) => option.value === value)
const filterValue = computed({
  get: () => filter.value,
  set: (value: string) => {
    const option = filterOf(value)
    if (option) filter.value = option.value
  }
})
/** How many rows a filter holds, once the server has said. */
function countOf(value: string) {
  const option = filterOf(value)
  return option && counts.value ? counts.value[option.value] : null
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <PortalLoadAlert v-if="error" :error="error" @retry="reload()" />
    <div v-if="searchLabel || filters.length" :class="ui.toolbar()">
      <!-- On a narrow page the filters scroll sideways rather than leave it. -->
      <div v-if="filters.length" class="max-w-full overflow-x-auto">
        <!-- As tall as the search field beside it, in the same type. -->
        <SegmentedControl
          v-model="filterValue"
          required
          :label="label"
          :options="filters"
          :ui="{ root: 'h-8', item: 'h-7 px-2.5 text-xs' }"
        >
          <template #option="{ option }">
            {{ option.label }}
            <span v-if="countOf(option.value) !== null" class="text-muted tabular-nums">
              {{ countOf(option.value) }}
            </span>
            <!-- Holds the count's place until the server has counted. -->
            <AppSkeleton v-else-if="status === 'loading'" class="w-3" />
          </template>
        </SegmentedControl>
      </div>
      <AppInput
        v-if="searchLabel"
        v-model="query"
        type="search"
        :placeholder="searchLabel"
        :aria-label="searchLabel"
        class="ml-auto w-64 max-w-full"
      >
        <template #leading><icon-lucide-search class="size-3.5" /></template>
      </AppInput>
    </div>
    <AppDataTable
      :table="table"
      :label="label"
      :hidden="hidden"
      :loading="loading"
      :loading-label="messages.loading"
    >
      <!-- A failed load says so above the table; it does not mean nothing matched. -->
      <template v-if="!error" #empty>
        <AppPlaceholder
          size="compact"
          :fill="false"
          :label="emptyLabel"
          :description="emptyDescription"
        >
          <template #icon><slot name="icon" /></template>
        </AppPlaceholder>
      </template>
      <!-- After a failed load the rows are gone, so the last range would no longer be true. -->
      <template v-if="total && !error" #footer>
        <AppTablePagination
          :range="range"
          :can-previous="table.getCanPreviousPage()"
          :can-next="table.getCanNextPage()"
          :previous-label="messages.previousPage"
          :next-label="messages.nextPage"
          @previous="table.previousPage()"
          @next="table.nextPage()"
        />
      </template>
    </AppDataTable>
  </div>
</template>

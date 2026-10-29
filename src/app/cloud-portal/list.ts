import {
  functionalUpdate,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
  type Updater
} from '@tanstack/vue-table'
import { refDebounced } from '@vueuse/core'
import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import type { TableColumnMeta } from '@/components/ui/table/columns'

import { usePortalLoad } from './state'

/** The rows a console list shows at a time. */
export const PORTAL_PAGE_SIZE = 50
/** How long typing pauses before a search asks the server. */
const SEARCH_DELAY_MS = 250

/** What console tables can do: the server pages them, and columns carry their own classes. */
export const portalTableFeatures = tableFeatures({
  rowPaginationFeature,
  // A type-only slot: TanStack reads the columns' `meta` type from it.
  columnMeta: {} as TableColumnMeta
})
export type PortalTableFeatures = typeof portalTableFeatures
export type PortalColumn<Row extends RowData> = ColumnDef<PortalTableFeatures, Row>

/** What a console list asks the server for: words to search for, a filter, and a page. */
export type PortalListRequest<Filter extends string> = {
  search?: string
  filter: Filter
  limit: number
  offset: number
}

/** A console table of rows the page already holds, such as an account's sessions. */
export function usePortalRows<Row extends RowData>(
  rows: MaybeRefOrGetter<Row[]>,
  options: { rowId: (row: Row) => string; columns: PortalColumn<Row>[] }
) {
  return useTable({
    features: portalTableFeatures,
    columns: options.columns,
    data: computed(() => toValue(rows)),
    getRowId: options.rowId
  })
}

/** A page of a console list, as the server answers it. */
export type PortalListPage<Filter extends string, Row> = {
  rows: Row[]
  /** How many rows match the search and filter, across every page. */
  total: number
  /** How many rows match the search under each filter. */
  counts: Record<Filter, number>
}

/**
 * A console list the server searches, filters, and pages: what the person types, which filter is
 * on, and the page shown, loaded again whenever one changes. A new search or filter starts from
 * the first page, and a change that empties the last page steps back to the one before.
 */
export function usePortalList<Filter extends string, Row extends RowData>(options: {
  filter: Filter
  load: (request: PortalListRequest<Filter>) => Promise<PortalListPage<Filter, Row>>
  rowId: (row: Row) => string
  columns: PortalColumn<Row>[]
}) {
  const messages = useCloudPortalMessages()
  const query = ref('')
  const search = refDebounced(query, SEARCH_DELAY_MS)
  const filter = shallowRef<Filter>(options.filter)
  const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: PORTAL_PAGE_SIZE })
  const offset = computed(() => pagination.value.pageIndex * pagination.value.pageSize)

  // Each page keeps the offset it was asked for, so the range describes the rows on screen, not
  // a page still on its way.
  const list = usePortalLoad(async () => {
    const request = {
      search: search.value.trim() || undefined,
      filter: filter.value,
      limit: pagination.value.pageSize,
      offset: offset.value
    }
    return { ...(await options.load(request)), offset: request.offset }
  }, null)
  const shownOffset = computed(() => list.data.value?.offset ?? 0)
  // After a failed load the last page belongs to another search or filter, so none is shown.
  const rows = computed(() => (list.error.value ? [] : (list.data.value?.rows ?? [])))
  const total = computed(() => list.data.value?.total ?? 0)
  const counts = computed(() => list.data.value?.counts ?? null)

  const table = useTable({
    features: portalTableFeatures,
    columns: options.columns,
    data: rows,
    rowCount: total,
    manualPagination: true,
    getRowId: options.rowId,
    state: computed(() => ({ pagination: pagination.value })),
    onPaginationChange: (next: Updater<PaginationState>) => {
      pagination.value = functionalUpdate(next, pagination.value)
    }
  })

  watch([search, filter], () => {
    if (pagination.value.pageIndex === 0) void list.reload()
    else pagination.value = { ...pagination.value, pageIndex: 0 }
  })
  watch(
    () => pagination.value.pageIndex,
    () => void list.reload()
  )
  watch(total, (count) => {
    const { pageIndex, pageSize } = pagination.value
    if (pageIndex > 0 && pageIndex * pageSize >= count) {
      pagination.value = { pageSize, pageIndex: Math.max(0, Math.ceil(count / pageSize) - 1) }
    }
  })

  return {
    table,
    query,
    filter,
    total,
    counts,
    loading: list.loading,
    status: list.status,
    error: list.error,
    reload: list.reload,
    /** Which rows the page shows, such as “51–100 of 230”. */
    range: computed(() =>
      messages.value.pageRange({
        from: Math.min(shownOffset.value + 1, total.value),
        to: Math.min(shownOffset.value + rows.value.length, total.value),
        total: total.value
      })
    )
  }
}

export type PortalList<Filter extends string, Row extends RowData> = ReturnType<
  typeof usePortalList<Filter, Row>
>

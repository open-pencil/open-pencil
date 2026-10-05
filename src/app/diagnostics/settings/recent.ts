import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  diagnostics,
  type DiagnosticCategory,
  type DiagnosticEvent,
  type DiagnosticEventSummary
} from '@/app/diagnostics'

/** Rows shown at first and added by each "Show more". */
export const DIAGNOSTICS_PAGE_SIZE = 20

/** `problems` keeps warnings and errors. */
export type DiagnosticsLevelFilter = 'all' | 'problems'

/**
 * Recently recorded events, newest first, filtered by level and category and shown a page at
 * a time. Only the shown page is summarized, since retention allows thousands of events.
 */
export function useRecentDiagnostics(
  summarize: (event: DiagnosticEvent) => DiagnosticEventSummary,
  refreshStats: () => Promise<void>
) {
  const events = shallowRef<DiagnosticEvent[]>([])
  const level = ref<DiagnosticsLevelFilter>('all')
  const category = ref<DiagnosticCategory | 'all'>('all')
  const limit = ref(DIAGNOSTICS_PAGE_SIZE)

  let version = 0
  let disposed = false

  async function refresh() {
    const request = ++version
    const listed = await diagnostics.list()
    if (!disposed && request === version) events.value = listed
  }

  const categories = computed(() => [...new Set(events.value.map((event) => event.category))])
  const matching = computed(() =>
    events.value.filter(
      (event) =>
        (level.value === 'all' || event.level === 'warning' || event.level === 'error') &&
        (category.value === 'all' || event.category === category.value)
    )
  )
  const visible = computed(() => matching.value.slice(0, limit.value).map(summarize))
  const hasMore = computed(() => matching.value.length > limit.value)

  function showMore(): void {
    limit.value += DIAGNOSTICS_PAGE_SIZE
  }

  // A new filter starts from the first page.
  watch([level, category], () => {
    limit.value = DIAGNOSTICS_PAGE_SIZE
  })

  const unsubscribe = diagnostics.subscribe(() => {
    void refresh()
    void refreshStats()
  })

  tryOnScopeDispose(() => {
    disposed = true
    unsubscribe()
  })

  // Events recorded before the panel opened count too.
  void refresh()
  void refreshStats()

  return {
    visible,
    total: computed(() => matching.value.length),
    hasMore,
    showMore,
    level,
    category,
    categories
  }
}

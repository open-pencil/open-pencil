import { tryOnScopeDispose } from '@vueuse/core'
import { ref } from 'vue'

import { diagnostics, type DiagnosticEventSummary } from '@/app/diagnostics'

export function useRecentDiagnostics(
  summarize: (events: Awaited<ReturnType<typeof diagnostics.list>>) => DiagnosticEventSummary[],
  refreshStats: () => Promise<void>
) {
  const recentEvents = ref<DiagnosticEventSummary[]>([])
  let version = 0
  let disposed = false
  async function refresh() {
    const request = ++version
    const events = await diagnostics.list()
    if (!disposed && request === version) recentEvents.value = summarize(events.slice(0, 20))
  }
  const unsubscribe = diagnostics.subscribe(() => {
    void refresh()
    void refreshStats()
  })
  tryOnScopeDispose(() => {
    disposed = true
    unsubscribe()
  })
  void refresh()
  return { recentEvents }
}

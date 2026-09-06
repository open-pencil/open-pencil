import { tryOnScopeDispose } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { diagnostics } from '@/app/diagnostics'
import { isUsageEnabled } from '@/app/diagnostics/settings'
import { summarizeUsage, type UsageSummary } from '@/app/usage'

export function useUsageSettings() {
  let version = 0
  let disposed = false

  const summary = ref<UsageSummary>(summarizeUsage([]))

  async function refresh() {
    const request = ++version
    const events = await diagnostics.list()
    if (!disposed && request === version && isUsageEnabled()) summary.value = summarizeUsage(events)
  }

  onMounted(() => {
    if (!isUsageEnabled()) return

    void refresh()
  })

  const unsubscribe = diagnostics.subscribe(() => {
    if (isUsageEnabled()) void refresh()
    else {
      version++
      summary.value = summarizeUsage([])
    }
  })

  tryOnScopeDispose(() => {
    disposed = true
    unsubscribe()
  })

  return { summary }
}

import { tryOnScopeDispose } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { diagnostics } from '@/app/diagnostics'
import { isUsageEnabled } from '@/app/diagnostics/settings'
import { summarizeUsage, type UsageSummary } from '@/app/usage'
export function useUsageSettings() {
  const summary = ref<UsageSummary>(summarizeUsage([]))
  async function refresh() {
    summary.value = summarizeUsage(await diagnostics.list())
  }
  onMounted(() => {
    if (!isUsageEnabled()) return
    void refresh()
  })
  const unsubscribe = diagnostics.subscribe(() => {
    if (isUsageEnabled()) void refresh()
    else summary.value = summarizeUsage([])
  })
  tryOnScopeDispose(unsubscribe)

  return { summary }
}

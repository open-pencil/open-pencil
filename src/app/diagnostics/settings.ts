import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

export type DiagnosticsRetention = 100 | 500 | 1000

const diagnosticsEnabled = useLocalStorage('open-pencil:diagnostics-enabled', true)
const usageEnabled = useLocalStorage('open-pencil:usage-enabled', true)
const diagnosticsRetention = useLocalStorage<DiagnosticsRetention>(
  'open-pencil:diagnostics-retention',
  500,
  { serializer: { read: (value) => normalizeRetention(value), write: String } }
)
const diagnosticsCount = ref(0)
const diagnosticsSize = ref(0)

function normalizeRetention(value: string): DiagnosticsRetention {
  const parsed = Number(value)
  return parsed === 100 || parsed === 1000 ? parsed : 500
}

export function useDiagnosticsSettings() {
  return {
    diagnosticsEnabled,
    usageEnabled,
    diagnosticsRetention,
    diagnosticsCount: computed(() => diagnosticsCount.value),
    diagnosticsSize: computed(() => diagnosticsSize.value),
    refreshDiagnosticsStats: async () => {
      const { diagnostics } = await import('./recorder')
      const events = await diagnostics.list()
      diagnosticsCount.value = events.length
      diagnosticsSize.value = JSON.stringify(events).length
    }
  }
}

export function isDiagnosticsEnabled(): boolean {
  return diagnosticsEnabled.value
}

export function isUsageEnabled(): boolean {
  return usageEnabled.value
}

export function getDiagnosticsRetention(): DiagnosticsRetention {
  return diagnosticsRetention.value
}

export async function pruneDiagnostics(retention: DiagnosticsRetention): Promise<void> {
  const { diagnostics } = await import('./recorder')
  await diagnostics.prune(retention)
}

export const diagnosticsRetentionOptions = computed(() => [100, 500, 1000] as const)

import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

/**
 * Number of most recent events kept locally. Bounded rather than a closed set
 * so retention can be tuned beyond the offered presets.
 */
export type DiagnosticsRetention = number

/** Offered directly in Settings; any value in range is accepted. */
export const diagnosticsRetentionPresets = [100, 500, 1000] as const

export const DIAGNOSTICS_RETENTION_DEFAULT: DiagnosticsRetention = 500
export const DIAGNOSTICS_RETENTION_MIN = 50
export const DIAGNOSTICS_RETENTION_MAX = 20_000

/** Clamp stored or entered values, falling back to the default when unusable. */
export function resolveDiagnosticsRetention(value: unknown): DiagnosticsRetention {
  // An empty or non-numeric stored value is unusable rather than a small number,
  // so it falls back to the default instead of clamping down to the minimum.
  const parsed =
    typeof value === 'string' ? (value.trim() === '' ? Number.NaN : Number(value)) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    return DIAGNOSTICS_RETENTION_DEFAULT
  }
  const whole = Math.round(parsed)
  return Math.min(Math.max(whole, DIAGNOSTICS_RETENTION_MIN), DIAGNOSTICS_RETENTION_MAX)
}

const diagnosticsEnabled = useLocalStorage('open-pencil:diagnostics-enabled', true)
const usageEnabled = useLocalStorage('open-pencil:usage-enabled', true)
const diagnosticsRetention = useLocalStorage<DiagnosticsRetention>(
  'open-pencil:diagnostics-retention',
  500,
  { serializer: { read: (value) => resolveDiagnosticsRetention(value), write: String } }
)
const diagnosticsCount = ref(0)
const diagnosticsSize = ref(0)

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

export const diagnosticsRetentionOptions = computed(() => diagnosticsRetentionPresets)

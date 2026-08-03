import { useOnline } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { lastSyncFailure } from '@/app/storage/sync/failure'
import { pendingSyncCount, syncUiState } from '@/app/storage/sync/status'

/**
 * What the indicator shows.
 *
 * `local` is deliberately calm. A permanent orange dot for a configuration the
 * user chose is alarm fatigue — it trains people to ignore the colour that
 * signals real failure. Orange and red both mean *you wanted sync and are not
 * getting it*; nothing else may use them.
 */
export type SyncIndicator = 'local' | 'synced' | 'syncing' | 'degraded' | 'failing'

/** Most syncs finish inside this, and should render nothing at all. */
const SPINNER_DELAY_MS = 400
/** Once shown, hold it this long — a 50 ms flash reads as a glitch. */
const SPINNER_MIN_VISIBLE_MS = 500

export function useSyncStatus(options: { configured: () => boolean }) {
  const browserOnline = useOnline()
  const { dialogs } = useI18n()

  const rawIndicator = computed<SyncIndicator>(() => {
    if (!options.configured()) return 'local'
    switch (syncUiState.value) {
      case 'syncing':
        return 'syncing'
      case 'offline':
        return 'degraded'
      case 'error':
      case 'blocked':
        return 'failing'
      default:
        return 'synced'
    }
  })

  // The outbox fires on every save, so a naive spinner strobes. Delay showing
  // it, then hold it — both guards are needed: the delay alone still flickers
  // when a sync lands at 401 ms.
  const spinnerVisible = ref(false)
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let shownAt = 0

  function clearTimers(): void {
    if (showTimer) clearTimeout(showTimer)
    if (hideTimer) clearTimeout(hideTimer)
    showTimer = null
    hideTimer = null
  }

  watch(
    () => rawIndicator.value === 'syncing',
    (syncing) => {
      clearTimers()
      if (syncing) {
        if (spinnerVisible.value) return
        showTimer = setTimeout(() => {
          spinnerVisible.value = true
          shownAt = Date.now()
        }, SPINNER_DELAY_MS)
        return
      }
      if (!spinnerVisible.value) return
      const remaining = SPINNER_MIN_VISIBLE_MS - (Date.now() - shownAt)
      if (remaining <= 0) {
        spinnerVisible.value = false
        return
      }
      hideTimer = setTimeout(() => {
        spinnerVisible.value = false
      }, remaining)
    },
    { immediate: true }
  )

  onScopeDispose(clearTimers)

  /**
   * What the chip actually renders.
   *
   * The spinner guards keep the ICON still, but a label driven by the raw state
   * would still flash "Syncing…" for a 200 ms sync — the same strobe, moved
   * into the text. Below the spinner threshold the chip keeps its settled
   * presentation, which stays true: the target is reachable, and any queued
   * work is already reported through the pending count.
   */
  const indicator = computed<SyncIndicator>(() => {
    if (rawIndicator.value !== 'syncing' || spinnerVisible.value) return rawIndicator.value
    return options.configured() ? 'synced' : 'local'
  })

  const failure = computed(() => lastSyncFailure.value)

  /**
   * Green means reachable, not backed up. Showing the pending count alongside
   * keeps that honest — a green dot over a queue of twelve unsent documents is
   * the most dangerous thing this surface could say.
   */
  const pendingCount = computed(() => pendingSyncCount.value)

  const label = computed(() => {
    const t = dialogs.value
    switch (indicator.value) {
      case 'local':
        return t.syncStatusLocalOnly
      case 'syncing':
        return pendingCount.value > 1
          ? t.syncStatusSyncingCount({ count: pendingCount.value })
          : t.syncStatusSyncing
      case 'degraded':
        return browserOnline.value ? t.syncStatusUnreachable : t.syncStatusOffline
      case 'failing':
        return t.syncStatusFailed
      default:
        return pendingCount.value > 0
          ? t.syncStatusWaiting({ count: pendingCount.value })
          : t.syncStatusSynced
    }
  })

  /** Only states the user can act on open the detail view. */
  const actionable = computed(() => indicator.value === 'failing' || indicator.value === 'degraded')

  return { indicator, label, pendingCount, failure, spinnerVisible, actionable, browserOnline }
}

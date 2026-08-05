import { useOnline } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { backupToCloud } from '@/app/storage/backup'
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
export type SyncIndicator = 'local' | 'synced' | 'syncing' | 'degraded' | 'failing' | 'conflicted'

/** Most syncs finish inside this, and should render nothing at all. */
const SPINNER_DELAY_MS = 400
/** Once shown, hold it this long — a 50 ms flash reads as a glitch. */
const SPINNER_MIN_VISIBLE_MS = 500

export function useSyncStatus(options: {
  configured: () => boolean
  /** Named in the label so the strip alone answers "which cloud, and is it working". */
  providerLabel?: () => string
}) {
  const browserOnline = useOnline()
  const { dialogs } = useI18n()

  const rawIndicator = computed<SyncIndicator>(() => {
    // Paused reads the same as unconfigured on purpose: both mean nothing is
    // going to the cloud, and neither is a fault. Alarm colours are reserved
    // for wanting sync and not getting it.
    if (!options.configured() || !backupToCloud.value) return 'local'
    switch (syncUiState.value) {
      case 'syncing':
        return 'syncing'
      case 'offline':
        return 'degraded'
      case 'error':
      case 'blocked':
        return 'failing'
      case 'conflict':
        return 'conflicted'
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
    const provider = options.providerLabel?.()
    switch (indicator.value) {
      case 'local':
        // Distinguish "nothing is configured" from an intentionally paused
        // configured target. Both are local-only, but only one needs setup.
        return options.configured() ? t.syncStatusLocalOnly : t.workingOffline
      case 'syncing':
        return t.syncStatusSyncing
      case 'degraded':
        if (!browserOnline.value) return t.syncStatusOffline
        return provider ? t.cloudUnreachableVia({ provider }) : t.syncStatusUnreachable
      case 'failing':
        return provider ? t.syncFailedVia({ provider }) : t.syncStatusFailed
      case 'conflicted':
        // No provider in this label on purpose. A conflict belongs to one
        // document and its target, and the only provider name reachable here
        // is whichever is selected in settings right now — which is how a
        // Bunny-bound conflict came to be reported as "Sync failed — R2".
        return t.syncConflictTitle
      default:
        if (pendingCount.value > 0) return t.syncStatusWaiting
        // Naming the provider here is what lets the workspace header stop
        // repeating the connection state above the document grid.
        return provider ? t.syncedViaProvider({ provider }) : t.syncStatusSynced
    }
  })

  /**
   * States with a failure worth reading.
   *
   * `conflicted` is not one: the error modal renders `lastSyncFailure`, and the
   * conflict path records none by design, so opening it showed an empty
   * "no failure details" dialog. Resolution lives on the document.
   */
  const actionable = computed(() => indicator.value === 'failing' || indicator.value === 'degraded')

  /**
   * No cloud yet — the strip becomes the way to set one up.
   *
   * A first run has nothing to report and nothing to fix, so the chip would
   * otherwise be inert exactly when a new user most needs a next step. Making
   * it a door rather than a label keeps the invitation available permanently
   * without ever interrupting: nothing pops up, nothing blocks, and a user who
   * never wants cloud simply never clicks it.
   */
  const canConnect = computed(() => indicator.value === 'local' && !options.configured())

  return {
    indicator,
    label,
    pendingCount,
    failure,
    spinnerVisible,
    actionable,
    canConnect,
    browserOnline
  }
}

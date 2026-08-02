import { computed, ref } from 'vue'

import type { SyncUiState } from '@/app/storage/sync/types'

/** Global subtle sync status for UI chips. */
export const syncUiState = ref<SyncUiState>('idle')
/** Short label for the chip. Truncated — never use this for diagnostics. */
export const syncUiDetail = ref<string | null>(null)
/**
 * Full, untruncated failure text for the error modal and copyable diagnostics.
 * Kept separate because the chip needs a short string and a bug report needs the
 * whole thing, including the endpoint and provider error code.
 */
export const syncUiErrorDetail = ref<string | null>(null)
export const pendingSyncCount = ref(0)

const CHIP_DETAIL_MAX = 120

export const syncStatusLabel = computed(() => {
  switch (syncUiState.value) {
    case 'syncing':
      return syncUiDetail.value ?? 'Syncing…'
    case 'offline':
      return 'Offline · will sync'
    case 'error':
      return syncUiDetail.value ?? 'Sync failed'
    case 'blocked':
      return syncUiDetail.value ?? 'Sync paused — needs attention'
    default:
      return null
  }
})

/** True when the user should be able to open the error modal. */
export const syncHasFailure = computed(
  () => syncUiState.value === 'error' || syncUiState.value === 'blocked'
)

export function setSyncUi(state: SyncUiState, detail: string | null = null) {
  syncUiState.value = state
  syncUiDetail.value = detail == null ? null : detail.slice(0, CHIP_DETAIL_MAX)
  // Preserve the full text on failure states; clear it once we recover so a
  // stale error can't be reopened from the modal after a successful sync.
  if (state === 'error' || state === 'blocked') {
    if (detail != null) syncUiErrorDetail.value = detail
  } else {
    syncUiErrorDetail.value = null
  }
}

export function setPendingSyncCount(count: number) {
  pendingSyncCount.value = count
}

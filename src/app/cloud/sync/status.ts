import { computed, ref } from 'vue'

import type { SyncUiState } from '@/app/cloud/sync/types'

/** Global subtle sync status for UI chips. */
export const syncUiState = ref<SyncUiState>('idle')
export const syncUiDetail = ref<string | null>(null)
export const pendingSyncCount = ref(0)

export const syncStatusLabel = computed(() => {
  switch (syncUiState.value) {
    case 'syncing':
      return syncUiDetail.value ?? 'Syncing…'
    case 'offline':
      return 'Offline · will sync'
    case 'error':
      return syncUiDetail.value ?? 'Sync failed'
    default:
      return null
  }
})

export function setSyncUi(state: SyncUiState, detail: string | null = null) {
  syncUiState.value = state
  syncUiDetail.value = detail
}

export function setPendingSyncCount(count: number) {
  pendingSyncCount.value = count
}

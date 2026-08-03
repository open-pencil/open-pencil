import { computed, ref, watch, type ComputedRef } from 'vue'

import {
  activeStorageProviderID,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageFieldID,
  type StorageProviderID
} from '@/app/integrations/storage'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { settingsDialogOpen } from '@/app/settings/dialog'

export type StorageCredentialStatuses = Record<StorageFieldID, CredentialStatus>

/** Every credential the provider marks required is present. */
export function storageCredentialsSatisfied(
  providerId: StorageProviderID,
  statuses: StorageCredentialStatuses
): boolean {
  return storageProviderRegistry
    .get(providerId)
    .credentialFields.every((field) => !field.required || statuses[field.id] === 'configured')
}

/**
 * Whether the active provider is usable as a sync target.
 *
 * The sync chip renders outside the workspace — in the editor header — where no
 * listing pass has ever run, so it cannot borrow `StorageView`'s status. It
 * re-reads credential status on the two events that can change the answer:
 * switching provider, and closing the settings dialog.
 */
export function useStorageConfigured(): ComputedRef<boolean> {
  const statuses = ref<StorageCredentialStatuses>({})

  async function refresh(): Promise<void> {
    // Pin the provider across the await: a slow status read must not be
    // attributed to whichever provider is selected by the time it resolves.
    const providerId = activeStorageProviderID.value
    const next = await storageCredentialStatuses(providerId)
    if (providerId !== activeStorageProviderID.value) return
    statuses.value = next
  }

  watch(activeStorageProviderID, () => void refresh(), { immediate: true })
  watch(settingsDialogOpen, (open, wasOpen) => {
    if (wasOpen && !open) void refresh()
  })

  return computed(
    () =>
      storagePreferencesComplete(activeStorageProviderID.value) &&
      storageCredentialsSatisfied(activeStorageProviderID.value, statuses.value)
  )
}

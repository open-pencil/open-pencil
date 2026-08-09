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
import { providerIdOfTarget, type StorageTargetID } from '@/app/storage/target'

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
 * One-shot, non-reactive answer to "can this provider receive an upload right
 * now" — the same definition the workspace footer uses: required preferences
 * filled AND required credentials present.
 *
 * A target id resolves from preferences alone (credential rotation must not
 * re-identify the destination), so a provider can name a destination it cannot
 * currently write to. Enqueue-time gates need this fuller check; without it a
 * half-configured provider enqueues jobs that can only fail, and each failure
 * paints a healthy local document red.
 */
export async function storageProviderUsable(providerId: StorageProviderID): Promise<boolean> {
  if (!storagePreferencesComplete(providerId)) return false
  const statuses = await storageCredentialStatuses(providerId)
  return storageCredentialsSatisfied(providerId, statuses)
}

/** Same check, addressed by target: unusable when the provider is gone too. */
export async function storageTargetUsable(targetId: StorageTargetID): Promise<boolean> {
  const providerId = providerIdOfTarget(targetId)
  if (providerId === null) return false
  return storageProviderUsable(providerId)
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

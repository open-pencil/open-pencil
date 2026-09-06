import { tryOnScopeDispose } from '@vueuse/core'
import { computed, onMounted, ref, watch, type Ref } from 'vue'

import {
  createActiveStorageAdapter,
  activeStorageProviderID,
  readStoragePreferences,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  writeStoragePreference
} from '@/app/integrations/storage'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { resumeStorageSync } from '@/app/storage/sync'

export function useStorageSettings(credentialDrafts: Ref<Record<string, string>>) {
  const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))

  const preferenceDrafts = ref<Record<string, string>>({
    ...readStoragePreferences(provider.value.id)
  })
  const credentialStatuses = ref<Record<string, CredentialStatus>>({})
  const busy = ref(false)

  const configured = computed(
    () =>
      storagePreferencesComplete(provider.value.id) &&
      provider.value.credentialFields.every(
        (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
      )
  )

  let statusRequest = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    statusRequest++
  })

  async function refreshStatuses(): Promise<void> {
    const request = ++statusRequest
    const target = provider.value
    try {
      const statuses = await storageCredentialStatuses(target.id)
      if (!disposed && statusRequest === request && provider.value.id === target.id)
        credentialStatuses.value = statuses
    } catch {
      if (!disposed && statusRequest === request && provider.value.id === target.id) {
        credentialStatuses.value = Object.fromEntries(
          target.credentialFields.map((field) => [field.id, 'unavailable' as const])
        )
      }
    }
  }

  function savePreferences(): void {
    for (const field of provider.value.preferenceFields) {
      writeStoragePreference(provider.value.id, field.id, preferenceDrafts.value[field.id] ?? '')
    }
    void resumeStorageSync()
  }

  async function saveCredential(field: string): Promise<void> {
    const target = credentialDrafts.value
    const value = target[field]?.trim()
    if (!value) return

    await appCredentialServices.manager.set(credentialRef(provider.value.id, field), value)
    if (credentialDrafts.value === target && target[field]?.trim() === value) target[field] = ''
    await refreshStatuses()
    await resumeStorageSync()
  }

  async function clearCredential(field: string): Promise<void> {
    const target = credentialDrafts.value
    await appCredentialServices.manager.clear(credentialRef(provider.value.id, field))
    if (credentialDrafts.value === target) target[field] = ''
    await refreshStatuses()
  }

  watch(activeStorageProviderID, (providerID) => {
    credentialStatuses.value = {}
    preferenceDrafts.value = { ...readStoragePreferences(providerID) }
    credentialDrafts.value = {}
    void refreshStatuses()
  })

  onMounted(() => void refreshStatuses())

  async function testConnection() {
    busy.value = true
    const target = provider.value

    try {
      savePreferences()
      for (const field of target.credentialFields) {
        if (provider.value.id !== target.id) return null

        await saveCredential(field.id)
      }
      await resumeStorageSync()
      if (provider.value.id !== target.id) return null

      const result = await createActiveStorageAdapter(target.id).testConnection()
      return provider.value.id === target.id ? result : null
    } catch (error) {
      if (provider.value.id !== target.id) return null

      return { ok: false as const, message: error instanceof Error ? error.message : String(error) }
    } finally {
      busy.value = false
    }
  }

  return {
    testConnection,
    provider,
    preferenceDrafts,
    credentialStatuses,
    busy,
    configured,
    savePreferences,
    saveCredential,
    clearCredential
  }
}

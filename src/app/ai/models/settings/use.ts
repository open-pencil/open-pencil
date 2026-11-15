import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import {
  aiModelSettings,
  modelConnection,
  modelConnectionCredentialStatus,
  modelCredentialRevision
} from '@/app/ai/models'
import { profileModelName } from '@/app/ai/models/profile-model-name'
import { modelProviderName } from '@/app/ai/models/provider-name'
import type { CredentialStatus } from '@/app/settings/credentials/types'

/**
 * Credential statuses as last read, shared by every view of the model list, so reopening
 * Settings draws them at once instead of starting from nothing.
 */
const knownStatuses = ref<Record<string, CredentialStatus>>({})

export function useModelSettings() {
  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
  })

  const statusByConnection = knownStatuses

  const profiles = computed(() =>
    aiModelSettings.value.models.map((profile) => {
      const connection = modelConnection(profile.connectionId)
      return {
        ...profile,
        providerID: connection?.providerID ?? '',
        providerName: modelProviderName(connection?.providerID ?? ''),
        modelName: profileModelName(profile)
      }
    })
  )

  async function refreshStatuses(): Promise<void> {
    const request = ++version
    const entries = await Promise.all(
      aiModelSettings.value.connections.map(async (connection) => {
        // One unreadable credential marks its own row instead of failing the whole list.
        const status: CredentialStatus = await modelConnectionCredentialStatus(connection.id).catch(
          () => 'unavailable'
        )
        return [connection.id, status] as const
      })
    )
    if (!disposed && request === version) statusByConnection.value = Object.fromEntries(entries)
  }

  watch(
    () => [
      aiModelSettings.value.connections.map((connection) => connection.id),
      modelCredentialRevision.value
    ],
    () => void refreshStatuses(),
    { immediate: true }
  )

  return { profiles, statusByConnection, refreshStatuses }
}

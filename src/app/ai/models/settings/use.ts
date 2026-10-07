import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import {
  aiModelSettings,
  modelConnection,
  modelConnectionCredentialStatus,
  modelCredentialRevision
} from '@/app/ai/models'
import { modelProviderName } from '@/app/ai/models/provider-name'
import type { CredentialStatus } from '@/app/settings/credentials/types'

export function useModelSettings() {
  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
  })

  const statusByConnection = ref<Record<string, CredentialStatus>>({})

  const profiles = computed(() =>
    aiModelSettings.value.models.map((profile) => {
      const connection = modelConnection(profile.connectionId)
      const provider = AI_PROVIDERS.find((definition) => definition.id === connection?.providerID)
      const modelId = profile.customModelID || profile.modelID
      const modelName = provider?.models.find((model) => model.id === modelId)?.name || modelId

      return {
        ...profile,
        providerID: connection?.providerID ?? '',
        providerName: modelProviderName(connection?.providerID ?? ''),
        modelName
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

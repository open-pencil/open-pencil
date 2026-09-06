import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS } from '@open-pencil/core/constants'

import { aiModelSettings, modelConnection, modelConnectionCredentialStatus } from '@/app/ai/models'
import type { CredentialStatus } from '@/app/settings/credentials/types'

export function useModelSettings() {
  let version = 0
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
  })

  const statusByConnection = ref<Record<string, CredentialStatus>>({})

  function providerName(providerID: string): string {
    if (providerID === 'harness:pi') return 'Pi'
    if (providerID.startsWith('acp:')) {
      const agentID = providerID.slice('acp:'.length)
      return ACP_AGENTS.find((agent) => agent.id === agentID)?.name ?? providerID
    }
    return AI_PROVIDERS.find((provider) => provider.id === providerID)?.name ?? providerID
  }

  const profiles = computed(() =>
    aiModelSettings.value.models.map((profile) => {
      const connection = modelConnection(profile.connectionId)
      const provider = AI_PROVIDERS.find((definition) => definition.id === connection?.providerID)
      const modelId = profile.customModelID || profile.modelID
      const modelName = provider?.models.find((model) => model.id === modelId)?.name || modelId

      return {
        ...profile,
        providerID: connection?.providerID ?? '',
        providerName: providerName(connection?.providerID ?? ''),
        modelName
      }
    })
  )

  async function refreshStatuses(): Promise<void> {
    const request = ++version
    const entries = await Promise.all(
      aiModelSettings.value.connections.map(
        async (connection) =>
          [connection.id, await modelConnectionCredentialStatus(connection.id)] as const
      )
    )
    if (!disposed && request === version) statusByConnection.value = Object.fromEntries(entries)
  }

  watch(
    () => aiModelSettings.value.connections.map((connection) => connection.id),
    () => void refreshStatuses(),
    { immediate: true }
  )

  return { profiles, statusByConnection, refreshStatuses }
}

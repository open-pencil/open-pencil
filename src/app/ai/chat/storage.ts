import { computed, ref, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import {
  designCustomAPIType,
  designCustomBaseURL,
  designCustomModelID,
  designMaxOutputTokens,
  designModelConnection,
  designModelID,
  designProviderDefinition,
  designProviderID,
  modelConnectionCredentialRef
} from '@/app/ai/models'
import { appCredentialServices, browserCredentialsRemembered } from '@/app/settings/credentials/app'
import {
  refreshMediaCredentials,
  credentialPersistenceRevision
} from '@/app/settings/credentials/media'
import { initializeCredentialMigration } from '@/app/settings/credentials/migration'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export const providerID = designProviderID
export const modelID = designModelID
export const customBaseURL = designCustomBaseURL
export const customModelID = designCustomModelID
export const customAPIType = designCustomAPIType
export const maxOutputTokens = designMaxOutputTokens
export const providerDef = designProviderDefinition

export const apiKeyStatus = ref<CredentialStatus>('missing')
const credentialRevision = ref(0)

export const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
export const isHarnessProvider = computed(() => providerID.value === 'harness:pi')
export const isAgentProvider = computed(() => isACPProvider.value || isHarnessProvider.value)

export const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI
  if (isHarnessProvider.value) return IS_TAURI && apiKeyStatus.value === 'configured'
  if (apiKeyStatus.value !== 'configured') return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  return !needsBaseURL || Boolean(customBaseURL.value)
})

async function refreshStatus(reference: CredentialRef): Promise<CredentialStatus> {
  return appCredentialServices.manager.status(reference)
}

function designCredentialReference(): CredentialRef | null {
  const connection = designModelConnection.value
  if (!connection || connection.providerID.startsWith('acp:')) return null
  return modelConnectionCredentialRef(connection)
}

export async function refreshAIProviderStatus(): Promise<void> {
  const reference = designCredentialReference()
  apiKeyStatus.value = reference ? await refreshStatus(reference) : 'missing'
}

export const credentialsReady = initializeCredentialMigration().then(async () => {
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
  return undefined
})

export async function resolveAPIKey(): Promise<string | null> {
  await credentialsReady
  const reference = designCredentialReference()
  return reference ? appCredentialServices.resolver.resolve(reference) : null
}

export async function setAPIKey(key: string): Promise<void> {
  const reference = designCredentialReference()
  if (!reference) return
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(reference, value)
  else await appCredentialServices.manager.clear(reference)
  apiKeyStatus.value = await refreshStatus(reference)
  credentialRevision.value++
}

export { browserCredentialsRemembered }

export function registerAIChatEffects(markTransportDirty: () => void) {
  watch(
    () => designModelConnection.value?.id,
    () => {
      void refreshAIProviderStatus()
      markTransportDirty()
    }
  )
  watch(modelID, markTransportDirty)
  watch(customModelID, markTransportDirty)
  watch(customAPIType, markTransportDirty)
  watch(customBaseURL, markTransportDirty)
  watch(maxOutputTokens, markTransportDirty)
  watch(credentialPersistenceRevision, () => {
    void refreshAIProviderStatus()
    markTransportDirty()
  })
  watch(credentialRevision, markTransportDirty)
}

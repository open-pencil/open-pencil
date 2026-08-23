import { computed, ref, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import { setPexelsAPIKey, setUnsplashAccessKey } from '@open-pencil/core/tools'

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
  initializeCredentialMigration,
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL
} from '@/app/settings/credentials/migration'
import { setAppCredentialPersistence } from '@/app/settings/credentials/persistence'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export const providerID = designProviderID
export const modelID = designModelID
export const customBaseURL = designCustomBaseURL
export const customModelID = designCustomModelID
export const customAPIType = designCustomAPIType
export const maxOutputTokens = designMaxOutputTokens
export const providerDef = designProviderDefinition

export const apiKeyStatus = ref<CredentialStatus>('missing')
export const pexelsKeyStatus = ref<CredentialStatus>('missing')
export const unsplashKeyStatus = ref<CredentialStatus>('missing')
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

async function refreshMediaCredentials(): Promise<void> {
  const [pexelsStatus, unsplashStatus] = await Promise.all([
    refreshStatus(PEXELS_CREDENTIAL),
    refreshStatus(UNSPLASH_CREDENTIAL)
  ])
  pexelsKeyStatus.value = pexelsStatus
  unsplashKeyStatus.value = unsplashStatus
  setPexelsAPIKey(
    pexelsStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(PEXELS_CREDENTIAL)
      : null
  )
  setUnsplashAccessKey(
    unsplashStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(UNSPLASH_CREDENTIAL)
      : null
  )
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

export async function setPexelsKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(PEXELS_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(PEXELS_CREDENTIAL)
  pexelsKeyStatus.value = await refreshStatus(PEXELS_CREDENTIAL)
  setPexelsAPIKey(value || null)
}

export async function setUnsplashKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(UNSPLASH_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(UNSPLASH_CREDENTIAL)
  unsplashKeyStatus.value = await refreshStatus(UNSPLASH_CREDENTIAL)
  setUnsplashAccessKey(value || null)
}

export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await credentialsReady
  await setAppCredentialPersistence(remembered)
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
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
  watch(credentialRevision, markTransportDirty)
}

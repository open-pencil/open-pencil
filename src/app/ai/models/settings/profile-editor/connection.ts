import { computed, ref, type Ref } from 'vue'

import type { AIProviderDef } from '@open-pencil/core/constants'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import { refreshAIProviderStatus } from '@/app/ai/chat/storage'
import {
  findModelConnectionForDraft,
  modelConnectionCredentialStatus,
  resolveModelConnectionAPIKey,
  setModelConnectionAPIKey,
  type AIModelProfileDraft
} from '@/app/ai/models'
import type { CredentialStatus } from '@/app/settings/credentials/types'

interface ConnectionOptions {
  draft: AIModelProfileDraft
  keyInput: Ref<string>
  providerDef: Readonly<Ref<AIProviderDef>>
  isACP: Readonly<Ref<boolean>>
  isHarness: Readonly<Ref<boolean>>
  customModelSelected: Ref<boolean>
}

export function useProfileConnection({
  draft,
  keyInput,
  providerDef,
  isACP,
  isHarness,
  customModelSelected
}: ConnectionOptions) {
  const keyStatus = ref<CredentialStatus>('missing')
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const hasExistingKey = computed(() => keyStatus.value === 'configured')
  const canTest = computed(() => {
    if (isACP.value || isHarness.value) return false
    if (!keyInput.value.trim() && !hasExistingKey.value) return false
    if (providerDef.value.supportsCustomBaseURL && !draft.customBaseURL.trim()) return false
    return customModelSelected.value
      ? Boolean(draft.customModelID.trim())
      : Boolean(draft.modelID.trim())
  })

  function resetConnectionTest(): void {
    connectionTestStatus.value = 'idle'
    connectionTestReason.value = null
  }

  async function refreshKeyStatus(): Promise<void> {
    const connection = findModelConnectionForDraft(draft)
    keyStatus.value = connection ? await modelConnectionCredentialStatus(connection.id) : 'missing'
  }

  async function clearKey(): Promise<void> {
    const connection = findModelConnectionForDraft(draft)
    if (!connection) return

    await setModelConnectionAPIKey(connection.id, '')
    await refreshAIProviderStatus()
    keyInput.value = ''
    await refreshKeyStatus()
  }

  async function testConnection(): Promise<void> {
    connectionTestStatus.value = 'testing'
    connectionTestReason.value = null
    const connection = findModelConnectionForDraft(draft)
    const existingKey = connection ? await resolveModelConnectionAPIKey(connection.id) : null
    const result = await testProviderConnection({
      providerID: draft.providerID,
      apiKey: keyInput.value.trim() || existingKey || '',
      modelID: draft.modelID,
      customModelID: draft.customModelID,
      customBaseURL: draft.customBaseURL,
      customAPIType: draft.customAPIType
    })
    if (result.ok) {
      connectionTestStatus.value = 'success'
      return
    }
    connectionTestStatus.value = 'error'
    connectionTestReason.value = result.reason
  }

  return {
    keyStatus,
    connectionTestStatus,
    connectionTestReason,
    hasExistingKey,
    canTest,
    resetConnectionTest,
    refreshKeyStatus,
    clearKey,
    testConnection
  }
}

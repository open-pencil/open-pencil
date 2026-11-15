import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, type Ref } from 'vue'

import {
  findModelConnectionForDraft,
  modelConnectionCredentialStatus,
  modelConnectionCredentialStore,
  resolveModelConnectionAPIKey,
  type AIModelProfileDraft
} from '@/app/ai/models'
import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason,
  type ProviderConnectionTestResult
} from '@/app/ai/models/connection-test'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { cloudAIClient } from '@/app/cloud/integration'
import type { CredentialStatus } from '@/app/settings/credentials/types'

/** Tests Cloud's AI service with the Home server's sign-in, which needs no key. */
async function testCloudConnection(
  target: AIModelProfileDraft
): Promise<ProviderConnectionTestResult> {
  const client = cloudAIClient(target.cloudWorkspaceId ?? '')
  if (!client) return { ok: false, reason: 'cloud-unavailable' }
  const cloud = cloudModelConfig(client, target.modelID)
  return testProviderConnection(cloud.config, cloud.runtime)
}

interface ConnectionOptions {
  draft: AIModelProfileDraft
  keyInput: Ref<string>
}

export function useProfileConnection({ draft, keyInput }: ConnectionOptions) {
  const keyStatus = ref<CredentialStatus>('missing')
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const keyCleared = ref(false)
  const hasExistingKey = computed(() => !keyCleared.value && keyStatus.value === 'configured')

  let version = 0
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true
    version++
  })
  function current(request: number) {
    return !disposed && request === version
  }

  function resetConnectionTest(): void {
    version++
    connectionTestStatus.value = 'idle'
    connectionTestReason.value = null
  }

  async function refreshKeyStatus(): Promise<void> {
    const request = version
    const connection = findModelConnectionForDraft(draft)
    try {
      const status = connection ? await modelConnectionCredentialStatus(connection.id) : 'missing'
      if (current(request)) keyStatus.value = status
    } catch {
      if (current(request)) keyStatus.value = 'unavailable'
    }
  }

  function clearKey(): void {
    keyCleared.value = true
    keyInput.value = ''
    resetConnectionTest()
  }

  /** Tests with the replacement key or the saved one; `null` once a newer test supersedes it. */
  async function testKeyConnection(
    target: AIModelProfileDraft,
    replacement: string,
    request: number
  ): Promise<ProviderConnectionTestResult | null> {
    const connection = findModelConnectionForDraft(target)
    const existingKey =
      !replacement && !keyCleared.value && connection
        ? await resolveModelConnectionAPIKey(connection.id)
        : null
    if (!current(request)) return null
    return testProviderConnection(
      {
        providerID: target.providerID,
        apiKey: replacement || existingKey || '',
        modelID: target.modelID,
        customModelID: target.customModelID,
        customBaseURL: target.customBaseURL,
        customAPIType: target.customAPIType
      },
      existingKey && connection
        ? { credentials: modelConnectionCredentialStore(connection.id) }
        : undefined
    )
  }

  async function testConnection(): Promise<void> {
    const request = ++version
    const target = { ...draft }
    const replacement = keyInput.value.trim()
    connectionTestStatus.value = 'testing'
    connectionTestReason.value = null
    try {
      const result =
        target.providerID === OPENPENCIL_AI_PROVIDER
          ? await testCloudConnection(target)
          : await testKeyConnection(target, replacement, request)
      if (!result || !current(request)) return
      connectionTestStatus.value = result.ok ? 'success' : 'error'
      connectionTestReason.value = result.ok ? null : result.reason
    } catch {
      if (!current(request)) return
      connectionTestStatus.value = 'error'
      connectionTestReason.value = 'unknown'
    }
  }

  return {
    keyCleared,
    keyStatus,
    connectionTestStatus,
    connectionTestReason,
    hasExistingKey,
    resetConnectionTest,
    refreshKeyStatus,
    clearKey,
    testConnection
  }
}

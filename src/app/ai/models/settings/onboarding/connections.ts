import { tryOnScopeDispose } from '@vueuse/core'
import { reactive } from 'vue'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import {
  aiModelSettings,
  modelConnectionCredentialStatus,
  resolveModelConnectionAPIKey,
  type AIModelConnection
} from '@/app/ai/models'
import type { OpenRouterKeyInfo } from '@/app/ai/providers/openrouter/key'
import type { CredentialStatus } from '@/app/settings/credentials/types'

import {
  isOnboardingAgent,
  ONBOARDING_SERVER_PROVIDER,
  type OnboardingAccess,
  type PlannedModel
} from './plan'

export type ConnectionTestStatus = 'idle' | 'testing' | 'success' | 'error'

export interface OnboardingConnectionState {
  /** A newly entered key; kept only until it is saved or setup closes. */
  apiKey: string
  customBaseURL: string
  customModelID: string
  test: ConnectionTestStatus
  reason: ProviderConnectionTestFailureReason | null
  /** Set once a key from signing in has been checked with the provider. */
  account: OpenRouterKeyInfo | null
}

/** Local servers with a well-known OpenAI-compatible address. */
export const ONBOARDING_SERVER_PRESETS = [
  { id: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', baseURL: 'http://localhost:1234/v1' }
] as const

export type OnboardingServerPreset = (typeof ONBOARDING_SERVER_PRESETS)[number]['id'] | 'custom'

/** The preset whose address the person entered, or `custom` for any other server. */
export function serverPresetFor(baseURL: string): OnboardingServerPreset {
  return (
    ONBOARDING_SERVER_PRESETS.find((preset) => preset.baseURL === baseURL.trim())?.id ?? 'custom'
  )
}

/** Details the person edits while connecting. */
export type OnboardingConnectionPatch = Partial<
  Pick<OnboardingConnectionState, 'apiKey' | 'customBaseURL' | 'customModelID'>
>

/**
 * The configured connection onboarding would reuse: the provider's connection without an
 * address, or for a server the one at the given address (any server when none is given).
 */
export function existingOnboardingConnection(
  providerID: OnboardingAccess,
  customBaseURL?: string
): AIModelConnection | null {
  const server = providerID === ONBOARDING_SERVER_PROVIDER
  return (
    aiModelSettings.value.connections.find(
      (connection) =>
        connection.providerID === providerID &&
        (server
          ? Boolean(connection.customBaseURL) &&
            (customBaseURL === undefined || connection.customBaseURL === customBaseURL.trim())
          : !connection.customBaseURL)
    ) ?? null
  )
}

interface OnboardingConnectionsOptions {
  plannedModel: (providerID: OnboardingAccess) => PlannedModel | null
}

/** Connection details, saved-key status, and connection tests for the providers being set up. */
export function useOnboardingConnections({ plannedModel }: OnboardingConnectionsOptions) {
  const states = reactive<Partial<Record<OnboardingAccess, OnboardingConnectionState>>>({})
  const keyStatuses = reactive<Record<string, CredentialStatus>>({})
  const testVersions = new Map<OnboardingAccess, number>()
  let disposed = false

  tryOnScopeDispose(() => {
    disposed = true
    clearKeys()
  })

  function clearKeys(): void {
    for (const state of Object.values(states)) state.apiKey = ''
  }

  async function loadKeyStatus(connectionId: string): Promise<void> {
    try {
      const status = await modelConnectionCredentialStatus(connectionId)
      if (!disposed) keyStatuses[connectionId] = status
    } catch {
      if (!disposed) keyStatuses[connectionId] = 'unavailable'
    }
  }

  function connection(providerID: OnboardingAccess): OnboardingConnectionState {
    const current = states[providerID]
    if (current) return current
    const existing = existingOnboardingConnection(providerID)
    const serverProfile =
      providerID === ONBOARDING_SERVER_PROVIDER && existing
        ? aiModelSettings.value.models.find((profile) => profile.connectionId === existing.id)
        : undefined
    states[providerID] = {
      apiKey: '',
      customBaseURL: existing?.customBaseURL ?? '',
      customModelID: serverProfile?.customModelID ?? '',
      test: 'idle',
      reason: null,
      account: null
    }
    return states[providerID]
  }

  /** The configured connection matching what is entered now, whose saved key may be used. */
  function savedConnection(providerID: OnboardingAccess): AIModelConnection | null {
    if (isOnboardingAgent(providerID)) return null
    const saved = existingOnboardingConnection(providerID, connection(providerID).customBaseURL)
    if (saved && !(saved.id in keyStatuses)) {
      keyStatuses[saved.id] = 'missing'
      void loadKeyStatus(saved.id)
    }
    return saved
  }

  function hasSavedKey(providerID: OnboardingAccess): boolean {
    const saved = savedConnection(providerID)
    return Boolean(saved && keyStatuses[saved.id] === 'configured')
  }

  function ready(providerID: OnboardingAccess): boolean {
    if (isOnboardingAgent(providerID)) return true
    const state = connection(providerID)
    if (state.test === 'success' || state.account) return true
    return (
      providerID !== ONBOARDING_SERVER_PROVIDER && hasSavedKey(providerID) && !state.apiKey.trim()
    )
  }

  /** Invalidates a finished or running test after the details it checked change. */
  function resetTest(providerID: OnboardingAccess): void {
    testVersions.set(providerID, (testVersions.get(providerID) ?? 0) + 1)
    const state = connection(providerID)
    state.test = 'idle'
    state.reason = null
  }

  /** Applies what the person typed; a changed connection needs a new test. */
  function updateConnection(providerID: OnboardingAccess, patch: OnboardingConnectionPatch): void {
    Object.assign(connection(providerID), patch)
    resetTest(providerID)
  }

  async function testConnection(providerID: OnboardingAccess): Promise<void> {
    const request = (testVersions.get(providerID) ?? 0) + 1
    testVersions.set(providerID, request)
    const state = connection(providerID)
    const current = () => !disposed && testVersions.get(providerID) === request
    state.test = 'testing'
    state.reason = null
    try {
      const saved = savedConnection(providerID)
      const savedKey =
        !state.apiKey.trim() && saved ? await resolveModelConnectionAPIKey(saved.id) : null
      if (!current()) return
      const result = await testProviderConnection({
        providerID,
        apiKey: state.apiKey.trim() || savedKey || '',
        modelID: plannedModel(providerID)?.modelID ?? '',
        customModelID: state.customModelID.trim(),
        customBaseURL: state.customBaseURL.trim(),
        customAPIType: saved?.customAPIType ?? 'completions'
      })
      if (!current()) return
      state.test = result.ok ? 'success' : 'error'
      state.reason = result.ok ? null : result.reason
    } catch {
      if (!current()) return
      state.test = 'error'
      state.reason = 'unknown'
    }
  }

  /** Records a key that setup stored, so the connection shows as saved without a reload. */
  function markKeySaved(connectionId: string): void {
    keyStatuses[connectionId] = 'configured'
  }

  return {
    connection,
    hasSavedKey,
    ready,
    resetTest,
    updateConnection,
    testConnection,
    clearKeys,
    markKeySaved
  }
}

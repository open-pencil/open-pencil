import type { LanguageModel } from 'ai'
import { ref } from 'vue'

import type { ReasoningEffort } from '@open-pencil/core/constants'

import { createLanguageModel, resolveLanguageModelID } from '@/app/ai/models/language-model'
import { resolveProviderModel } from '@/app/ai/models/reasoning/floors'
import { modelConnection, resolveAIModelRole } from '@/app/ai/models/store'
import type { AIModelConnection, AIModelRole, ResolvedAIModelRole } from '@/app/ai/models/types'
import { cloudModelConfig } from '@/app/ai/providers/openpencil/model'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import type { ModelCredentialStore } from '@/app/ai/providers/types'
import { cloudAIClient } from '@/app/cloud/integration'
import { appCredentialServices } from '@/app/settings/credentials/app'
import {
  initializeCredentialMigration,
  providerCredentialRef
} from '@/app/settings/credentials/migration'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export type DirectAIModelRuntime = {
  kind: 'direct'
  role: ResolvedAIModelRole
  model: LanguageModel
  minReasoningEffort?: ReasoningEffort
}

export type ACPModelRuntime = {
  kind: 'acp'
  role: ResolvedAIModelRole
}

export type HarnessModelRuntime = {
  kind: 'harness'
  role: ResolvedAIModelRole
}

export type AIModelRuntime = DirectAIModelRuntime | ACPModelRuntime | HarnessModelRuntime

export function modelConnectionCredentialRef(connection: AIModelConnection): CredentialRef {
  return providerCredentialRef(connection.providerID, connection.credentialProfileId)
}

export async function modelConnectionCredentialStatus(
  connectionId: string
): Promise<CredentialStatus> {
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return 'missing'
  return appCredentialServices.manager.status(modelConnectionCredentialRef(connection))
}

/** Changes whenever a model connection's key is saved or cleared, so status views can refresh. */
export const modelCredentialRevision = ref(0)

export async function setModelConnectionAPIKey(connectionId: string, value: string): Promise<void> {
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return
  const reference = modelConnectionCredentialRef(connection)
  const key = value.trim()
  try {
    if (key) await appCredentialServices.manager.set(reference, key)
    else await appCredentialServices.manager.clear(reference)
  } finally {
    modelCredentialRevision.value++
  }
}

export async function resolveModelConnectionAPIKey(connectionId: string): Promise<string | null> {
  await initializeCredentialMigration()
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return null
  return appCredentialServices.resolver.resolve(modelConnectionCredentialRef(connection))
}

/** The stored credential of a connection, for a model whose sign-in refreshes. */
export function modelConnectionCredentialStore(connectionId: string): ModelCredentialStore {
  return {
    load: () => resolveModelConnectionAPIKey(connectionId),
    // A refreshed sign-in is not a key change, so the open chat keeps its transport.
    save: async (value) => {
      const connection = modelConnection(connectionId)
      if (!connection) return
      await appCredentialServices.manager.set(modelConnectionCredentialRef(connection), value)
    }
  }
}

/** Cloud's AI service is unavailable: signed out, no service, or no workspace chosen. */
export class CloudAIUnavailableError extends Error {
  override readonly name = 'CloudAIUnavailableError'

  constructor() {
    super('OpenPencil Cloud AI is unavailable')
  }
}

function openPencilLanguageModel(resolved: ResolvedAIModelRole): LanguageModel {
  const client = cloudAIClient(resolved.connection.cloudWorkspaceId ?? '')
  if (!client) throw new CloudAIUnavailableError()
  const { config, runtime } = cloudModelConfig(client, resolved.profile.modelID)
  return createLanguageModel(config, runtime)
}

export async function createAIModelRuntime(role: AIModelRole): Promise<AIModelRuntime | null> {
  const resolved = resolveAIModelRole(role)
  if (!resolved) return null
  if (role === 'design' && !resolved.profile.capabilities.includes('tools')) {
    throw new Error('The Design model must support tools')
  }
  if (role === 'vision' && !resolved.profile.capabilities.includes('vision')) {
    throw new Error('The Vision model must support image input')
  }
  if (resolved.connection.providerID === 'harness:pi') {
    if (role !== 'design') {
      throw new Error('Harness agents can only be assigned to the Design agent role')
    }
    return { kind: 'harness', role: resolved }
  }
  if (resolved.connection.providerID.startsWith('acp:')) {
    if (role !== 'design') {
      throw new Error('ACP agents can only be assigned to the Design agent role')
    }
    return { kind: 'acp', role: resolved }
  }

  if (resolved.connection.providerID === OPENPENCIL_AI_PROVIDER) {
    return { kind: 'direct', role: resolved, model: openPencilLanguageModel(resolved) }
  }

  const apiKey = await resolveModelConnectionAPIKey(resolved.connection.id)
  if (!apiKey) throw new Error(`Credential is unavailable for the ${role} model role`)
  const { providerID } = resolved.connection
  const known = await resolveProviderModel(
    providerID,
    resolveLanguageModelID({ providerID, ...resolved.profile })
  )
  return {
    kind: 'direct',
    role: resolved,
    minReasoningEffort: known?.minReasoningEffort,
    model: createLanguageModel(
      {
        providerID: resolved.connection.providerID,
        apiKey,
        modelID: resolved.profile.modelID,
        customModelID: resolved.profile.customModelID,
        customBaseURL: resolved.connection.customBaseURL,
        customAPIType: resolved.connection.customAPIType
      },
      { credentials: modelConnectionCredentialStore(resolved.connection.id) }
    )
  }
}

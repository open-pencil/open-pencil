import { uniq } from 'es-toolkit'

import { DEFAULT_AI_PROVIDER, type AIProviderID } from '@open-pencil/core/constants'

import {
  aiModelSettings,
  createConnectionId,
  createModelId,
  DEFAULT_MAX_OUTPUT_TOKENS,
  LEGACY_MODEL_ID
} from './store'
import type {
  AIModelAssignments,
  AIModelCapability,
  AIModelProfile,
  AIModelRoleAssignment,
  OptionalAIModelRole
} from './types'

/**
 * Whether the models are still a fresh install's: the one Design model on the default provider,
 * with no server address, which can't have worked. Setting models up over it loses nothing.
 */
export function hasOnlyUnsetDefaultModel(): boolean {
  const { models, connections } = aiModelSettings.value
  const only = models.at(0)
  if (models.length !== 1 || only?.id !== LEGACY_MODEL_ID) return false
  const connection = connections.find((candidate) => candidate.id === only.connectionId)
  return connection?.providerID === DEFAULT_AI_PROVIDER && !connection.customBaseURL
}

/** A model a role is set up with: its ID, the name it shows under, and what it can do. */
export type RoleModelChoice = { modelID: string; name: string; capabilities: AIModelCapability[] }

/**
 * Replaces the models with one connection to `providerID`, paid for by `cloudWorkspaceId` when it
 * is Cloud's, and a profile for each model the roles take, assigned to them. A role on the Design
 * model follows it; Vision is left unassigned without a model that reads images.
 */
export function setUpRoleModels(
  providerID: AIProviderID,
  roles: { design: RoleModelChoice } & Record<OptionalAIModelRole, RoleModelChoice | null>,
  cloudWorkspaceId?: string
): void {
  const connectionId = createConnectionId()
  const profiles = new Map<string, AIModelProfile>()
  const profileFor = (choice: RoleModelChoice): AIModelProfile => {
    const known = profiles.get(choice.modelID)
    if (known) return known
    const profile: AIModelProfile = {
      id: createModelId(),
      name: choice.name,
      connectionId,
      modelID: choice.modelID,
      customModelID: '',
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      thinkingLevel: 'default',
      capabilities: uniq(choice.capabilities)
    }
    profiles.set(choice.modelID, profile)
    return profile
  }
  const design = profileFor(roles.design)
  const assign = (choice: RoleModelChoice | null): AIModelRoleAssignment => {
    if (!choice) return null
    return choice.modelID === roles.design.modelID ? 'design' : profileFor(choice).id
  }
  const vision = roles.vision?.capabilities.includes('vision') ? roles.vision : null
  // Assigning the roles makes their profiles, so the list is read once they are.
  const assignments: AIModelAssignments = {
    design: design.id,
    review: assign(roles.review),
    fast: assign(roles.fast),
    vision: assign(vision)
  }
  aiModelSettings.value = {
    version: 1,
    connections: [
      {
        id: connectionId,
        providerID,
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: connectionId,
        cloudWorkspaceId
      }
    ],
    models: [...profiles.values()],
    assignments
  }
}

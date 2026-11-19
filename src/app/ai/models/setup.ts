import { uniq } from 'es-toolkit'

import type { AIProviderID } from '@open-pencil/core/constants'

import {
  aiModelSettings,
  createConnectionId,
  createModelId,
  DEFAULT_MAX_OUTPUT_TOKENS
} from './store'
import type {
  AIModelAssignments,
  AIModelCapability,
  AIModelProfile,
  AIModelRoleAssignment,
  OptionalAIModelRole
} from './types'

/** A model a role is set up with: its ID, the name it shows under, and what it can do. */
export type RoleModelChoice = { modelID: string; name: string; capabilities: AIModelCapability[] }

/**
 * Replaces the models with one connection to `providerID`, paid for by `cloudWorkspaceId` when it
 * is Cloud's, and a profile for each model the roles take, assigned to them. Review and Vision on
 * the Design model follow it, while Fast takes the design profile itself, since Fast tasks run only
 * with a model of their own; Vision is left unassigned without a model that reads images.
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
    // Fast tasks run only with a model of their own, so they take the design profile itself.
    fast: roles.fast ? profileFor(roles.fast).id : null,
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

import type { AIProviderID } from '@open-pencil/core/constants'

export const AI_MODEL_ROLES = ['design', 'review', 'fast', 'vision'] as const
export const AI_MODEL_CAPABILITIES = ['tools', 'vision'] as const
export const HARNESS_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const
export const HARNESS_PERMISSION_MODES = ['allow-reads', 'allow-edits', 'allow-all'] as const

export type HarnessThinkingLevel = (typeof HARNESS_THINKING_LEVELS)[number]
export type HarnessPermissionMode = (typeof HARNESS_PERMISSION_MODES)[number]

export type AIModelRole = (typeof AI_MODEL_ROLES)[number]
export type AIModelProfileId = `model-${string}`
export type AIModelRoleAssignment = AIModelProfileId | 'design' | null
export type AIModelCapability = (typeof AI_MODEL_CAPABILITIES)[number]
export type OptionalAIModelRole = Exclude<AIModelRole, 'design'>

export type AIModelConnection = {
  id: string
  providerID: AIProviderID
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  credentialProfileId: string
}

export type AIModelProfile = {
  id: AIModelProfileId
  name: string
  connectionId: string
  modelID: string
  customModelID: string
  maxOutputTokens: number
  contextWindowTokens?: number
  textInput?: boolean
  reasoningEffort?: string
  harnessThinkingLevel?: HarnessThinkingLevel
  harnessPermissionMode?: HarnessPermissionMode
  capabilities: AIModelCapability[]
}

export type AIModelAssignments = {
  design: AIModelProfileId
  review: AIModelRoleAssignment
  fast: AIModelRoleAssignment
  vision: AIModelRoleAssignment
}

export type AIModelSettings = {
  version: 1
  connections: AIModelConnection[]
  models: AIModelProfile[]
  assignments: AIModelAssignments
}

export type AIModelProfileDraft = {
  profileId: AIModelProfileId | null
  sourceConnectionId: string | null
  name: string
  providerID: AIProviderID
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  maxOutputTokens: number
  contextWindowTokens?: number
  textInput?: boolean
  reasoningEffort: string
  harnessThinkingLevel: HarnessThinkingLevel
  harnessPermissionMode: HarnessPermissionMode
  capabilities: AIModelCapability[]
}

export type ResolvedAIModelRole = {
  requestedRole: AIModelRole
  profile: AIModelProfile
  connection: AIModelConnection
}

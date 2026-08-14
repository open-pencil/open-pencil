import { computed, ref, watch } from 'vue'

import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  type AIProviderID
} from '@open-pencil/core/constants'

import {
  readAIModelSettingsStorage,
  readLegacyAIModelStorage,
  writeAIModelSettingsStorage
} from '@/app/ai/models/storage'
import type {
  AIModelCapability,
  AIModelConnection,
  AIModelProfile,
  AIModelProfileDraft,
  AIModelProfileId,
  AIModelRole,
  AIModelRoleAssignment,
  AIModelSettings,
  OptionalAIModelRole,
  ResolvedAIModelRole
} from '@/app/ai/models/types'

const LEGACY_CONNECTION_ID = 'connection-default'
const LEGACY_MODEL_ID: AIModelProfileId = 'model-default'
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProviderID(value: unknown): value is AIProviderID {
  return (
    typeof value === 'string' &&
    (value.startsWith('acp:') || AI_PROVIDERS.some((provider) => provider.id === value))
  )
}

function isAPIType(value: unknown): value is 'completions' | 'responses' {
  return value === 'completions' || value === 'responses'
}

function isCapability(value: unknown): value is AIModelCapability {
  return value === 'tools' || value === 'vision'
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizedMaxOutputTokens(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(128_000, Math.max(1024, Math.round(value)))
    : DEFAULT_MAX_OUTPUT_TOKENS
}

function parseConnection(value: unknown): AIModelConnection | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const credentialProfileId = stringValue(value.credentialProfileId)
  if (!id || !credentialProfileId || !isProviderID(value.providerID)) return null
  return {
    id,
    providerID: value.providerID,
    customBaseURL: stringValue(value.customBaseURL),
    customAPIType: isAPIType(value.customAPIType) ? value.customAPIType : 'completions',
    credentialProfileId
  }
}

function parseProfile(value: unknown, connectionIds: Set<string>): AIModelProfile | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const connectionId = stringValue(value.connectionId)
  if (!id.startsWith('model-') || !connectionIds.has(connectionId)) return null
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter(isCapability)
    : ['tools' as const]
  return {
    id: id as AIModelProfileId,
    name: stringValue(value.name, 'Model'),
    connectionId,
    modelID: stringValue(value.modelID),
    customModelID: stringValue(value.customModelID),
    maxOutputTokens: normalizedMaxOutputTokens(value.maxOutputTokens),
    reasoningEffort: stringValue(value.reasoningEffort).trim() || undefined,
    capabilities: [...new Set(capabilities)]
  }
}

function optionalAssignment(value: unknown, modelIds: Set<string>): AIModelRoleAssignment {
  if (value === 'design' || value === null) return value
  return typeof value === 'string' && modelIds.has(value) ? (value as AIModelProfileId) : null
}

function parseSettings(value: unknown): AIModelSettings | null {
  if (!isRecord(value) || value.version !== 1) return null
  const connections = Array.isArray(value.connections)
    ? value.connections.map(parseConnection).filter((connection) => connection !== null)
    : []
  const connectionIds = new Set(connections.map((connection) => connection.id))
  const models = Array.isArray(value.models)
    ? value.models
        .map((profile) => parseProfile(profile, connectionIds))
        .filter((profile) => profile !== null)
    : []
  if (!models.length) return null
  const modelIds = new Set(models.map((profile) => profile.id))
  const rawAssignments = isRecord(value.assignments) ? value.assignments : {}
  const rawDesign = stringValue(rawAssignments.design)
  const design = rawDesign.startsWith('model-') ? (rawDesign as AIModelProfileId) : models[0].id
  const resolvedDesign = modelIds.has(design) ? design : models[0].id
  const assignments: AIModelSettings['assignments'] = {
    design: resolvedDesign,
    review: optionalAssignment(rawAssignments.review, modelIds),
    fast: optionalAssignment(rawAssignments.fast, modelIds),
    vision: optionalAssignment(rawAssignments.vision, modelIds)
  }
  for (const role of ['review', 'fast', 'vision'] as const) {
    const assignment = assignments[role]
    if (assignment === null) continue
    const profileId = assignment === 'design' ? resolvedDesign : assignment
    const profile = models.find((candidate) => candidate.id === profileId)
    const connection = connections.find((candidate) => candidate.id === profile?.connectionId)
    const invalidACP = connection?.providerID.startsWith('acp:')
    const invalidVision = role === 'vision' && !profile?.capabilities.includes('vision')
    if (invalidACP || invalidVision) assignments[role] = null
  }
  return { version: 1, connections, models, assignments }
}

function legacySettings(): AIModelSettings {
  const storedProvider = readLegacyAIModelStorage('ai-provider')
  const providerID = isProviderID(storedProvider) ? storedProvider : DEFAULT_AI_PROVIDER
  const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
  const modelID = readLegacyAIModelStorage('ai-model') ?? provider?.defaultModel ?? DEFAULT_AI_MODEL
  const customModelID = readLegacyAIModelStorage('ai-custom-model') ?? ''
  const displayModel = customModelID || modelID
  const name = displayModel
    ? provider?.models.find((model) => model.id === displayModel)?.name || displayModel
    : 'Design model'
  const maxOutputTokens = Number(readLegacyAIModelStorage('ai-max-output-tokens'))
  return {
    version: 1,
    connections: [
      {
        id: LEGACY_CONNECTION_ID,
        providerID,
        customBaseURL: readLegacyAIModelStorage('ai-base-url') ?? '',
        customAPIType:
          readLegacyAIModelStorage('ai-api-type') === 'responses' ? 'responses' : 'completions',
        credentialProfileId: 'default'
      }
    ],
    models: [
      {
        id: LEGACY_MODEL_ID,
        name,
        connectionId: LEGACY_CONNECTION_ID,
        modelID,
        customModelID,
        maxOutputTokens: Number.isFinite(maxOutputTokens)
          ? maxOutputTokens
          : DEFAULT_MAX_OUTPUT_TOKENS,
        capabilities: ['tools']
      }
    ],
    assignments: {
      design: LEGACY_MODEL_ID,
      review: 'design',
      fast: 'design',
      vision: null
    }
  }
}

function loadSettings(): AIModelSettings {
  return parseSettings(readAIModelSettingsStorage()) ?? legacySettings()
}

export const aiModelSettings = ref<AIModelSettings>(loadSettings())

watch(aiModelSettings, (settings) => writeAIModelSettingsStorage(settings), { deep: true })

function createConnectionId(): string {
  return `connection-${crypto.randomUUID()}`
}

function createModelId(): AIModelProfileId {
  return `model-${crypto.randomUUID()}`
}

export function modelProfile(profileId: string): AIModelProfile | null {
  return aiModelSettings.value.models.find((profile) => profile.id === profileId) ?? null
}

export function modelConnection(connectionId: string): AIModelConnection | null {
  return (
    aiModelSettings.value.connections.find((connection) => connection.id === connectionId) ?? null
  )
}

export function isDesignModelProfile(profile: AIModelProfile): boolean {
  return profile.capabilities.includes('tools')
}

export function designModelProfiles(): AIModelProfile[] {
  return aiModelSettings.value.models.filter(isDesignModelProfile)
}

export function isACPModelProfile(profile: AIModelProfile | null): boolean {
  return Boolean(profile && modelConnection(profile.connectionId)?.providerID.startsWith('acp:'))
}

export function resolveAIModelRole(role: AIModelRole): ResolvedAIModelRole | null {
  const assignment = aiModelSettings.value.assignments[role]
  if (assignment === null) return null
  const profileId = assignment === 'design' ? aiModelSettings.value.assignments.design : assignment
  const profile = modelProfile(profileId)
  if (!profile) return null
  if (role === 'design' && !isDesignModelProfile(profile)) return null
  if (role === 'vision' && !profile.capabilities.includes('vision')) return null
  const connection = modelConnection(profile.connectionId)
  return connection ? { requestedRole: role, profile, connection } : null
}

function connectionMatchesDraft(
  connection: AIModelConnection,
  draft: AIModelProfileDraft
): boolean {
  return (
    connection.providerID === draft.providerID &&
    connection.customBaseURL === draft.customBaseURL.trim() &&
    connection.customAPIType === draft.customAPIType
  )
}

export function findModelConnectionForDraft(draft: AIModelProfileDraft): AIModelConnection | null {
  const source = draft.sourceConnectionId ? modelConnection(draft.sourceConnectionId) : null
  if (source && connectionMatchesDraft(source, draft)) return source
  return (
    aiModelSettings.value.connections.find((connection) =>
      connectionMatchesDraft(connection, draft)
    ) ?? null
  )
}

function connectionForDraft(draft: AIModelProfileDraft): AIModelConnection {
  const existing = findModelConnectionForDraft(draft)
  if (existing) return existing
  const id = createConnectionId()
  const connection: AIModelConnection = {
    id,
    providerID: draft.providerID,
    customBaseURL: draft.customBaseURL.trim(),
    customAPIType: draft.customAPIType,
    credentialProfileId: id
  }
  aiModelSettings.value.connections.push(connection)
  return connection
}

function draftForProfile(
  profile: AIModelProfile,
  connection: AIModelConnection
): AIModelProfileDraft {
  return {
    profileId: profile.id,
    sourceConnectionId: profile.connectionId,
    name: profile.name,
    providerID: connection.providerID,
    modelID: profile.modelID,
    customModelID: profile.customModelID,
    customBaseURL: connection.customBaseURL,
    customAPIType: connection.customAPIType,
    maxOutputTokens: profile.maxOutputTokens,
    reasoningEffort: profile.reasoningEffort ?? '',
    capabilities: [...profile.capabilities]
  }
}

function newProfileDraft(connection: AIModelConnection | null): AIModelProfileDraft {
  const providerID = connection?.providerID ?? DEFAULT_AI_PROVIDER
  const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
  return {
    profileId: null,
    sourceConnectionId: connection?.id ?? null,
    name: '',
    providerID,
    modelID: provider?.defaultModel ?? '',
    customModelID: '',
    customBaseURL: connection?.customBaseURL ?? '',
    customAPIType: connection?.customAPIType ?? 'completions',
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    reasoningEffort: '',
    capabilities: ['tools']
  }
}

export function createModelProfileDraft(profileId?: string): AIModelProfileDraft {
  const profile = profileId ? modelProfile(profileId) : null
  const profileConnection = profile ? modelConnection(profile.connectionId) : null
  if (profile && profileConnection) return draftForProfile(profile, profileConnection)
  const designConnection = resolveAIModelRole('design')?.connection ?? null
  return newProfileDraft(designConnection ?? aiModelSettings.value.connections[0])
}

export function saveModelProfileDraft(draft: AIModelProfileDraft): AIModelProfile {
  const provider = AI_PROVIDERS.find((definition) => definition.id === draft.providerID)
  const effectiveModel = draft.customModelID.trim() || draft.modelID.trim()
  if (!draft.name.trim()) throw new Error('Model name is required')
  if (!draft.providerID.startsWith('acp:') && !effectiveModel) {
    throw new Error('Model ID is required')
  }
  if (
    draft.profileId === aiModelSettings.value.assignments.design &&
    !draft.capabilities.includes('tools')
  ) {
    throw new Error('The Design model must support tools')
  }
  const connection = connectionForDraft(draft)
  const profile: AIModelProfile = {
    id: draft.profileId ?? createModelId(),
    name: draft.name.trim(),
    connectionId: connection.id,
    modelID: draft.modelID.trim() || provider?.defaultModel || '',
    customModelID: draft.customModelID.trim(),
    maxOutputTokens: normalizedMaxOutputTokens(draft.maxOutputTokens),
    reasoningEffort: draft.reasoningEffort.trim() || undefined,
    capabilities: [...new Set(draft.capabilities)]
  }
  const index = aiModelSettings.value.models.findIndex((model) => model.id === profile.id)
  if (index === -1) aiModelSettings.value.models.push(profile)
  else aiModelSettings.value.models[index] = profile
  if (
    aiModelSettings.value.assignments.vision === profile.id &&
    !profile.capabilities.includes('vision')
  ) {
    aiModelSettings.value.assignments.vision = null
  }
  return profile
}

export function modelConnectionUsageCount(connectionId: string): number {
  return aiModelSettings.value.models.filter((profile) => profile.connectionId === connectionId)
    .length
}

export function removeModelProfile(profileId: string): void {
  if (aiModelSettings.value.models.length <= 1) return
  const removesDesignAssignment = aiModelSettings.value.assignments.design === profileId
  const fallback = aiModelSettings.value.models.find(
    (profile) => profile.id !== profileId && isDesignModelProfile(profile)
  )
  if (removesDesignAssignment && !fallback) return

  const removed = modelProfile(profileId)
  aiModelSettings.value.models = aiModelSettings.value.models.filter(
    (profile) => profile.id !== profileId
  )
  if (removesDesignAssignment && fallback) {
    aiModelSettings.value.assignments.design = fallback.id
    if (
      aiModelSettings.value.assignments.vision === 'design' &&
      !fallback.capabilities.includes('vision')
    ) {
      aiModelSettings.value.assignments.vision = null
    }
  }
  for (const role of ['review', 'fast', 'vision'] as const) {
    if (aiModelSettings.value.assignments[role] === profileId) {
      aiModelSettings.value.assignments[role] = null
    }
  }
  if (removed && modelConnectionUsageCount(removed.connectionId) === 0) {
    aiModelSettings.value.connections = aiModelSettings.value.connections.filter(
      (connection) => connection.id !== removed.connectionId
    )
  }
}

export function setModelRoleAssignment(role: 'design', assignment: AIModelProfileId): void
export function setModelRoleAssignment(
  role: OptionalAIModelRole,
  assignment: AIModelRoleAssignment
): void
export function setModelRoleAssignment(role: AIModelRole, assignment: AIModelRoleAssignment): void {
  if (role === 'design') {
    if (assignment === null || assignment === 'design') return
    const profile = modelProfile(assignment)
    if (!profile || !isDesignModelProfile(profile)) return
    aiModelSettings.value.assignments.design = assignment
    return
  }
  if (assignment !== null && assignment !== 'design' && !modelProfile(assignment)) return
  if (assignment !== null) {
    const profile =
      assignment === 'design'
        ? modelProfile(aiModelSettings.value.assignments.design)
        : modelProfile(assignment)
    if (isACPModelProfile(profile)) return
    if (role === 'vision' && !profile?.capabilities.includes('vision')) return
  }
  aiModelSettings.value.assignments[role] = assignment
}

export function replaceAIModelSettings(settings: AIModelSettings): void {
  aiModelSettings.value = structuredClone(settings)
}

export const designModelProfile = computed(() => resolveAIModelRole('design')?.profile ?? null)
export const designModelConnection = computed(
  () => resolveAIModelRole('design')?.connection ?? null
)
export const designProviderID = computed(
  () => designModelConnection.value?.providerID ?? DEFAULT_AI_PROVIDER
)
export const designProviderDefinition = computed(
  () => AI_PROVIDERS.find((provider) => provider.id === designProviderID.value) ?? AI_PROVIDERS[0]
)
export const designModelID = computed({
  get: () => designModelProfile.value?.modelID ?? '',
  set: (modelID: string) => {
    const profile = designModelProfile.value
    if (profile) profile.modelID = modelID
  }
})
export const designCustomModelID = computed({
  get: () => designModelProfile.value?.customModelID ?? '',
  set: (modelID: string) => {
    const profile = designModelProfile.value
    if (profile) profile.customModelID = modelID
  }
})
export const designCustomBaseURL = computed(() => designModelConnection.value?.customBaseURL ?? '')
export const designCustomAPIType = computed(
  () => designModelConnection.value?.customAPIType ?? 'completions'
)
export const designMaxOutputTokens = computed(
  () => designModelProfile.value?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
)

export function modelSettingsSnapshot(): AIModelSettings {
  const settings = aiModelSettings.value
  return {
    version: 1,
    connections: settings.connections.map((connection) => ({ ...connection })),
    models: settings.models.map((profile) => ({
      ...profile,
      capabilities: [...profile.capabilities]
    })),
    assignments: { ...settings.assignments }
  }
}

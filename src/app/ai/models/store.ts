import { uniq } from 'es-toolkit'
import * as v from 'valibot'
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
import {
  HARNESS_PERMISSION_MODES,
  THINKING_LEVELS,
  type AIModelCapability,
  type AIModelConnection,
  type AIModelProfile,
  type AIModelProfileDraft,
  type AIModelProfileId,
  type AIModelRole,
  type AIModelRoleAssignment,
  type AIModelSettings,
  type OptionalAIModelRole,
  type ResolvedAIModelRole,
  type ThinkingLevel
} from '@/app/ai/models/types'

const LEGACY_CONNECTION_ID = 'connection-default'
const LEGACY_MODEL_ID: AIModelProfileId = 'model-default'
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384

function isProviderID(value: unknown): value is AIProviderID {
  return (
    typeof value === 'string' &&
    (value.startsWith('acp:') || AI_PROVIDERS.some((provider) => provider.id === value))
  )
}

const connectionSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  providerID: v.custom<AIProviderID>(isProviderID),
  customBaseURL: v.fallback(v.string(), ''),
  customAPIType: v.fallback(v.picklist(['completions', 'responses']), 'completions'),
  credentialProfileId: v.pipe(v.string(), v.minLength(1))
})

const thinkingLevelSchema = v.picklist(THINKING_LEVELS)

/** Profiles saved before thinking levels kept a Pi level or a free-text provider effort. */
function migrateThinkingLevel(stored: {
  thinkingLevel?: unknown
  harnessThinkingLevel?: unknown
  reasoningEffort?: unknown
}): ThinkingLevel {
  for (const value of [stored.thinkingLevel, stored.harnessThinkingLevel]) {
    if (v.is(thinkingLevelSchema, value)) return value
  }
  const effort = typeof stored.reasoningEffort === 'string' ? stored.reasoningEffort : ''
  const normalized = effort.trim().toLowerCase()
  if (normalized === 'none') return 'off'
  if (normalized === 'max') return 'xhigh'
  return v.is(thinkingLevelSchema, normalized) ? normalized : 'default'
}

const maxOutputTokensSchema = v.fallback(
  v.pipe(
    v.number(),
    v.finite(),
    v.transform((tokens) => Math.min(128_000, Math.max(1024, Math.round(tokens))))
  ),
  DEFAULT_MAX_OUTPUT_TOKENS
)

function normalizedMaxOutputTokens(value: unknown): number {
  return v.parse(maxOutputTokensSchema, value)
}

const capabilitySchema = v.picklist(['tools', 'vision'])

const profileSchema = v.object({
  id: v.custom<AIModelProfileId>((id) => typeof id === 'string' && id.startsWith('model-')),
  name: v.fallback(v.string(), 'Model'),
  connectionId: v.string(),
  modelID: v.fallback(v.string(), ''),
  customModelID: v.fallback(v.string(), ''),
  maxOutputTokens: maxOutputTokensSchema,
  thinkingLevel: v.optional(v.unknown()),
  harnessThinkingLevel: v.optional(v.unknown()),
  reasoningEffort: v.optional(v.unknown()),
  harnessPermissionMode: v.fallback(v.optional(v.picklist(HARNESS_PERMISSION_MODES)), undefined),
  capabilities: v.fallback(
    v.pipe(
      v.array(v.unknown()),
      v.transform((capabilities) =>
        uniq(capabilities.filter((capability) => v.is(capabilitySchema, capability)))
      )
    ),
    (): AIModelCapability[] => ['tools']
  )
})

function parseConnection(value: unknown): AIModelConnection | null {
  const parsed = v.safeParse(connectionSchema, value)
  return parsed.success ? parsed.output : null
}

function parseProfile(value: unknown, connectionIds: Set<string>): AIModelProfile | null {
  const parsed = v.safeParse(profileSchema, value)
  if (!parsed.success || !connectionIds.has(parsed.output.connectionId)) return null
  const { harnessThinkingLevel, reasoningEffort, ...profile } = parsed.output
  return {
    ...profile,
    thinkingLevel: migrateThinkingLevel({ ...profile, harnessThinkingLevel, reasoningEffort })
  }
}

function optionalAssignment(value: unknown, modelIds: Set<string>): AIModelRoleAssignment {
  if (value === 'design' || value === null) return value
  return typeof value === 'string' && modelIds.has(value) ? (value as AIModelProfileId) : null
}

function curatedModelCapabilities(
  providerID: AIProviderID,
  modelID: string
): AIModelCapability[] | null {
  const model = AI_PROVIDERS.find((provider) => provider.id === providerID)?.models.find(
    (candidate) => candidate.id === modelID
  )
  return model?.capabilities ? [...model.capabilities] : null
}

function hydrateCuratedCapabilities(
  profiles: AIModelProfile[],
  connections: AIModelConnection[]
): void {
  for (const profile of profiles) {
    if (profile.customModelID) continue
    const connection = connections.find((candidate) => candidate.id === profile.connectionId)
    if (!connection) continue
    const capabilities = curatedModelCapabilities(connection.providerID, profile.modelID)
    if (capabilities) profile.capabilities = [...new Set(capabilities)]
  }
}

const settingsSchema = v.object({
  version: v.literal(1),
  connections: v.fallback(v.array(v.unknown()), () => []),
  models: v.fallback(v.array(v.unknown()), () => []),
  assignments: v.fallback(v.record(v.string(), v.unknown()), () => ({}))
})

/** Normalizes persisted settings, migrating fields from earlier versions. */
export function parseAIModelSettings(value: unknown): AIModelSettings | null {
  const stored = v.safeParse(settingsSchema, value)
  if (!stored.success) return null
  const connections = stored.output.connections
    .map(parseConnection)
    .filter((connection) => connection !== null)
  const connectionIds = new Set(connections.map((connection) => connection.id))
  const models = stored.output.models
    .map((profile) => parseProfile(profile, connectionIds))
    .filter((profile) => profile !== null)
  if (!models.length) return null
  hydrateCuratedCapabilities(models, connections)
  const modelIds = new Set(models.map((profile) => profile.id))
  const rawAssignments = stored.output.assignments
  const rawDesign = typeof rawAssignments.design === 'string' ? rawAssignments.design : ''
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
    const invalidAgent =
      connection?.providerID.startsWith('acp:') || connection?.providerID === 'harness:pi'
    const invalidVision = role === 'vision' && !profile?.capabilities.includes('vision')
    if (invalidAgent || invalidVision) assignments[role] = null
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
  const curatedCapabilities = customModelID ? null : curatedModelCapabilities(providerID, modelID)
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
        thinkingLevel: 'default',
        capabilities: curatedCapabilities ?? ['tools']
      }
    ],
    assignments: {
      design: LEGACY_MODEL_ID,
      review: 'design',
      fast: 'design',
      vision: curatedCapabilities?.includes('vision') ? 'design' : null
    }
  }
}

function loadSettings(): AIModelSettings {
  return parseAIModelSettings(readAIModelSettingsStorage()) ?? legacySettings()
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

export function isAgentModelProfile(profile: AIModelProfile | null): boolean {
  const providerID = profile ? modelConnection(profile.connectionId)?.providerID : undefined
  return Boolean(providerID?.startsWith('acp:') || providerID === 'harness:pi')
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
    thinkingLevel: profile.thinkingLevel,
    harnessPermissionMode: profile.harnessPermissionMode ?? 'allow-edits',
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
    thinkingLevel: 'default',
    harnessPermissionMode: 'allow-edits',
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
  // Agents choose their own model, and Pi falls back to its own default model.
  if (
    !draft.providerID.startsWith('acp:') &&
    draft.providerID !== 'harness:pi' &&
    !effectiveModel
  ) {
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
    thinkingLevel: draft.thinkingLevel,
    harnessPermissionMode:
      draft.providerID === 'harness:pi' ? draft.harnessPermissionMode : undefined,
    capabilities: [...new Set(draft.capabilities)]
  }
  const index = aiModelSettings.value.models.findIndex((model) => model.id === profile.id)
  if (index === -1) aiModelSettings.value.models.push(profile)
  else aiModelSettings.value.models[index] = profile
  if (
    aiModelSettings.value.assignments.vision === null &&
    aiModelSettings.value.assignments.design === profile.id &&
    profile.capabilities.includes('vision')
  ) {
    aiModelSettings.value.assignments.vision = 'design'
  }
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

export function canRemoveModelProfile(profileId: string): boolean {
  if (!modelProfile(profileId) || aiModelSettings.value.models.length <= 1) return false
  return (
    aiModelSettings.value.assignments.design !== profileId ||
    aiModelSettings.value.models.some(
      (profile) => profile.id !== profileId && isDesignModelProfile(profile)
    )
  )
}

export function removeModelProfile(profileId: string): void {
  if (!canRemoveModelProfile(profileId)) return
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
    if (isAgentModelProfile(profile)) return
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

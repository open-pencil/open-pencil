import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { buildReasoningProviderOptions } from '@/app/ai/chat/reasoning'
import {
  aiModelSettings,
  createAIModelRuntime,
  createModelProfileDraft,
  designModelProfiles,
  modelSettingsSnapshot,
  removeModelProfile,
  replaceAIModelSettings,
  resolveAIModelRole,
  saveModelProfileDraft,
  setModelConnectionAPIKey,
  setModelRoleAssignment,
  type AIModelSettings
} from '@/app/ai/models'
import { appCredentialRefs } from '@/app/settings/credentials/persistence'
import { credentialKey } from '@/app/settings/credentials/reference'

let original: AIModelSettings

function settingsFixture(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-anthropic',
        providerID: 'anthropic',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'anthropic-main'
      },
      {
        id: 'connection-google',
        providerID: 'google',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'google-main'
      }
    ],
    models: [
      {
        id: 'model-design',
        name: 'Design model',
        connectionId: 'connection-anthropic',
        modelID: 'claude-sonnet-4-6-20260301',
        customModelID: '',
        maxOutputTokens: 16_384,
        capabilities: ['tools', 'vision']
      },
      {
        id: 'model-fast',
        name: 'Fast model',
        connectionId: 'connection-google',
        modelID: 'gemini-3-flash-preview',
        customModelID: '',
        maxOutputTokens: 8192,
        capabilities: ['tools']
      }
    ],
    assignments: {
      design: 'model-design',
      review: 'design',
      fast: 'model-fast',
      vision: 'design'
    }
  }
}

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settingsFixture())
})

afterEach(() => {
  replaceAIModelSettings(original)
})

describe('AI model profiles and role assignments', () => {
  test('resolves inherited and independent assignments', () => {
    expect(resolveAIModelRole('review')).toMatchObject({
      requestedRole: 'review',
      profile: { id: 'model-design' },
      connection: { id: 'connection-anthropic' }
    })
    expect(resolveAIModelRole('fast')).toMatchObject({
      requestedRole: 'fast',
      profile: { id: 'model-fast' },
      connection: { id: 'connection-google' }
    })
  })

  test('enforces role capability requirements', () => {
    setModelRoleAssignment('design', 'model-fast')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-fast')

    setModelRoleAssignment('vision', 'model-fast')
    expect(resolveAIModelRole('vision')).toBeNull()

    setModelRoleAssignment('vision', null)
    expect(resolveAIModelRole('vision')).toBeNull()
  })

  test('switches the design agent between saved profiles', () => {
    const switchable = designModelProfiles()
    expect(switchable.map((profile) => profile.id)).toEqual(['model-design', 'model-fast'])

    setModelRoleAssignment('design', 'model-fast')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-fast')
    expect(resolveAIModelRole('design')?.connection.id).toBe('connection-google')

    setModelRoleAssignment('design', 'model-design')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('refuses to assign a profile that cannot use tools as the design agent', () => {
    aiModelSettings.value.models.push({
      id: 'model-textonly',
      name: 'Text only',
      connectionId: 'connection-google',
      modelID: 'text-only',
      customModelID: '',
      maxOutputTokens: 4096,
      capabilities: []
    })

    setModelRoleAssignment('design', 'model-textonly')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('reuses matching provider connections when adding models', () => {
    const draft = createModelProfileDraft()
    draft.name = 'Review model'
    draft.providerID = 'anthropic'
    draft.modelID = 'claude-opus-4-6-20260301'
    draft.sourceConnectionId = null

    const profile = saveModelProfileDraft(draft)
    expect(profile.connectionId).toBe('connection-anthropic')
    expect(modelSettingsSnapshot().connections).toHaveLength(2)
  })

  test('keeps ACP agents exclusive to the Design role', () => {
    const settings = modelSettingsSnapshot()
    settings.connections.push({
      id: 'connection-acp',
      providerID: 'acp:claude-code',
      customBaseURL: '',
      customAPIType: 'completions',
      credentialProfileId: 'connection-acp'
    })
    settings.models.push({
      id: 'model-acp',
      name: 'Claude Code',
      connectionId: 'connection-acp',
      modelID: '',
      customModelID: '',
      maxOutputTokens: 16_384,
      capabilities: ['tools']
    })
    replaceAIModelSettings(settings)

    setModelRoleAssignment('review', null)
    setModelRoleAssignment('review', 'model-acp')
    expect(resolveAIModelRole('review')).toBeNull()

    setModelRoleAssignment('design', 'model-acp')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-acp')
    setModelRoleAssignment('fast', null)
    setModelRoleAssignment('fast', 'design')
    expect(resolveAIModelRole('fast')).toBeNull()
  })

  test('normalizes invalid output limits before persistence', () => {
    const draft = createModelProfileDraft('model-fast')
    draft.maxOutputTokens = Number.NaN
    expect(saveModelProfileDraft(draft).maxOutputTokens).toBe(16_384)
  })

  test('persists provider-specific reasoning effort', () => {
    const draft = createModelProfileDraft('model-fast')
    draft.reasoningEffort = 'none'
    expect(saveModelProfileDraft(draft).reasoningEffort).toBe('none')
    expect(createModelProfileDraft('model-fast').reasoningEffort).toBe('none')
  })

  test('maps reasoning effort to supported provider options', () => {
    expect(buildReasoningProviderOptions('openai-compatible', 'none')).toEqual({
      openai: { reasoningEffort: 'none' }
    })
    expect(buildReasoningProviderOptions('openrouter', 'high')).toEqual({
      openrouter: { reasoning: { effort: 'high' } }
    })
    expect(buildReasoningProviderOptions('google', 'high')).toBeUndefined()
    expect(buildReasoningProviderOptions('openai', '')).toBeUndefined()
  })

  test('repairs assignments when removing a model', () => {
    removeModelProfile('model-design')
    const settings = modelSettingsSnapshot()
    expect(settings.assignments.design).toBe('model-fast')
    expect(settings.assignments.vision).toBeNull()
    expect(settings.connections.map((connection) => connection.id)).toEqual(['connection-google'])
  })

  test('keeps the assigned design profile when no capable fallback exists', () => {
    const settings = settingsFixture()
    settings.models = [
      settings.models[0],
      {
        id: 'model-text-only',
        name: 'Text-only model',
        connectionId: 'connection-google',
        modelID: 'text-only',
        customModelID: '',
        maxOutputTokens: 4096,
        capabilities: []
      }
    ]
    replaceAIModelSettings(settings)

    removeModelProfile('model-design')

    expect(modelSettingsSnapshot().models.map((profile) => profile.id)).toEqual([
      'model-design',
      'model-text-only'
    ])
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('includes configured connection credentials in persistence changes', () => {
    const keys = appCredentialRefs().map(credentialKey)
    expect(keys).toContain('v1:anthropic:anthropic-main:api-key')
    expect(keys).toContain('v1:google:google-main:api-key')
  })

  test('creates a role runtime without exposing its resolved credential', async () => {
    await setModelConnectionAPIKey('connection-anthropic', 'review-secret')
    try {
      const runtime = await createAIModelRuntime('review')
      expect(runtime?.kind).toBe('direct')
      expect(runtime?.role.profile.id).toBe('model-design')
      expect(runtime).not.toHaveProperty('apiKey')
    } finally {
      await setModelConnectionAPIKey('connection-anthropic', '')
    }
  })
})

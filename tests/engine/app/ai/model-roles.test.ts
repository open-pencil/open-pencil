import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { omit } from 'es-toolkit'

import { reasoningCallSettings } from '@/app/ai/chat/reasoning'
import {
  aiModelSettings,
  createAIModelRuntime,
  createModelProfileDraft,
  designModelProfiles,
  modelSettingsSnapshot,
  parseAIModelSettings,
  removeModelProfile,
  canRemoveModelProfile,
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
        thinkingLevel: 'default',
        capabilities: ['tools', 'vision']
      },
      {
        id: 'model-fast',
        name: 'Fast model',
        connectionId: 'connection-google',
        modelID: 'gemini-3-flash-preview',
        customModelID: '',
        maxOutputTokens: 8192,
        thinkingLevel: 'default',
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
      thinkingLevel: 'default',
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

  test('stores multiple Harness provider profiles with independent model IDs', () => {
    const first = createModelProfileDraft()
    Object.assign(first, {
      name: 'Pi Sonnet',
      providerID: 'harness:pi',
      modelID: '',
      customModelID: 'anthropic/claude-sonnet-4.6',
      thinkingLevel: 'medium',
      harnessPermissionMode: 'allow-edits'
    })
    const second = createModelProfileDraft()
    Object.assign(second, {
      name: 'Pi custom',
      providerID: 'harness:pi',
      modelID: '',
      customModelID: 'custom/provider-model',
      thinkingLevel: 'high',
      harnessPermissionMode: 'allow-reads'
    })

    const savedFirst = saveModelProfileDraft(first)
    const savedSecond = saveModelProfileDraft(second)
    expect(savedFirst.customModelID).toBe('anthropic/claude-sonnet-4.6')
    expect(savedSecond.customModelID).toBe('custom/provider-model')
    expect(savedFirst.thinkingLevel).toBe('medium')
    expect(savedSecond.thinkingLevel).toBe('high')
    expect(savedFirst.harnessPermissionMode).toBe('allow-edits')
    expect(savedSecond.harnessPermissionMode).toBe('allow-reads')
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
      thinkingLevel: 'default',
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

  test('persists the profile thinking level', () => {
    const draft = createModelProfileDraft('model-fast')
    expect(draft.thinkingLevel).toBe('default')
    draft.thinkingLevel = 'off'
    expect(saveModelProfileDraft(draft).thinkingLevel).toBe('off')
    expect(createModelProfileDraft('model-fast').thinkingLevel).toBe('off')
  })

  test('migrates saved reasoning effort and Pi levels to thinking levels', () => {
    const settings = settingsFixture()
    const legacy = (profile: AIModelSettings['models'][number], fields: object) => ({
      ...omit(profile, ['thinkingLevel']),
      ...fields
    })
    const [design, fast] = settings.models
    const parsed = parseAIModelSettings({
      ...settings,
      models: [
        legacy(design, { harnessThinkingLevel: 'high' }),
        legacy(fast, { reasoningEffort: 'none' })
      ]
    })
    expect(parsed?.models.map((profile) => profile.thinkingLevel)).toEqual(['high', 'off'])
  })

  test('maps thinking levels to the AI SDK reasoning option', () => {
    expect(reasoningCallSettings('anthropic', 'high')).toEqual({ reasoning: 'high' })
    expect(reasoningCallSettings('google', 'off')).toEqual({ reasoning: 'none' })
    expect(reasoningCallSettings('openai-compatible', 'xhigh')).toEqual({ reasoning: 'xhigh' })
    expect(reasoningCallSettings('openrouter', 'low')).toEqual({
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } }
    })
    expect(reasoningCallSettings('anthropic', 'default')).toEqual({})
  })

  test('repairs assignments when removing a model', () => {
    expect(canRemoveModelProfile('model-design')).toBe(true)
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
        thinkingLevel: 'default',
        capabilities: []
      }
    ]
    replaceAIModelSettings(settings)

    expect(canRemoveModelProfile('model-design')).toBe(false)
    expect(canRemoveModelProfile('model-text-only')).toBe(true)
    expect(canRemoveModelProfile('missing')).toBe(false)
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

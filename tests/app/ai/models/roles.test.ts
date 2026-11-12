import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { omit } from 'es-toolkit'

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
  type AIModelCapability,
  type AIModelProfile,
  type AIModelProfileId,
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

  describe('coding agents', () => {
    function agentProfile(
      id: AIModelProfileId,
      connectionId: string,
      capabilities: AIModelCapability[],
      modelID = ''
    ): AIModelProfile {
      return {
        id,
        name: id,
        connectionId,
        modelID,
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities
      }
    }

    beforeEach(() => {
      const settings = modelSettingsSnapshot()
      for (const [id, providerID] of [
        ['connection-acp', 'acp:claude-code'],
        ['connection-pi', 'harness:pi']
      ] as const) {
        settings.connections.push({
          id,
          providerID,
          customBaseURL: '',
          customAPIType: 'completions',
          credentialProfileId: id
        })
      }
      settings.models.push(
        agentProfile('model-acp', 'connection-acp', ['tools']),
        agentProfile('model-acp-vision', 'connection-acp', ['tools', 'vision'], 'sonnet'),
        agentProfile('model-pi', 'connection-pi', ['tools'])
      )
      settings.assignments.vision = null
      replaceAIModelSettings(settings)
    })

    test('take every role their capabilities allow', () => {
      setModelRoleAssignment('design', 'model-acp')
      expect(resolveAIModelRole('design')?.profile.id).toBe('model-acp')
      for (const role of ['review', 'fast'] as const) {
        setModelRoleAssignment(role, 'model-acp')
        expect(resolveAIModelRole(role)?.profile.id).toBe('model-acp')
      }
      setModelRoleAssignment('review', 'model-pi')
      expect(resolveAIModelRole('review')?.connection.providerID).toBe('harness:pi')

      setModelRoleAssignment('vision', 'model-acp')
      expect(resolveAIModelRole('vision')).toBeNull()
      setModelRoleAssignment('vision', 'model-acp-vision')
      expect(resolveAIModelRole('vision')?.profile.id).toBe('model-acp-vision')
    })

    test('are followed by the roles that use the Design model', () => {
      setModelRoleAssignment('design', 'model-acp')
      setModelRoleAssignment('review', 'design')
      expect(resolveAIModelRole('review')?.profile.id).toBe('model-acp')
      setModelRoleAssignment('vision', 'design')
      expect(resolveAIModelRole('vision')).toBeNull()

      setModelRoleAssignment('design', 'model-acp-vision')
      setModelRoleAssignment('vision', 'design')
      expect(resolveAIModelRole('vision')?.profile.id).toBe('model-acp-vision')
    })

    test('get a runtime of their own kind in any role', async () => {
      setModelRoleAssignment('review', 'model-acp')
      setModelRoleAssignment('fast', 'model-pi')
      setModelRoleAssignment('vision', 'model-acp-vision')
      expect(await createAIModelRuntime('review')).toMatchObject({
        kind: 'acp',
        role: { profile: { id: 'model-acp' } }
      })
      expect(await createAIModelRuntime('fast')).toMatchObject({
        kind: 'harness',
        role: { profile: { id: 'model-pi' } }
      })
      expect(await createAIModelRuntime('vision')).toMatchObject({
        kind: 'acp',
        role: { profile: { id: 'model-acp-vision', modelID: 'sonnet' } }
      })
    })

    test('keep the model and capabilities they are saved with', () => {
      const draft = createModelProfileDraft('model-acp-vision')
      expect(draft).toMatchObject({ modelID: 'sonnet', capabilities: ['tools', 'vision'] })
      setModelRoleAssignment('vision', 'model-acp-vision')
      draft.modelID = 'opus'
      draft.capabilities = ['tools']
      const saved = saveModelProfileDraft(draft)
      expect(saved).toMatchObject({ modelID: 'opus', capabilities: ['tools'] })
      expect(resolveAIModelRole('vision')).toBeNull()
    })

    test('always have tools, and only an ACP agent can have image input', () => {
      const acp = createModelProfileDraft('model-acp')
      acp.capabilities = ['vision']
      expect(saveModelProfileDraft(acp).capabilities).toEqual(['tools', 'vision'])

      const pi = createModelProfileDraft('model-pi')
      pi.capabilities = ['vision']
      expect(saveModelProfileDraft(pi).capabilities).toEqual(['tools'])
      setModelRoleAssignment('vision', 'model-pi')
      expect(resolveAIModelRole('vision')).toBeNull()
    })
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

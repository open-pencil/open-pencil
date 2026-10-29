import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  createModelProfileDraft,
  modelSettingsSnapshot,
  parseAIModelSettings,
  replaceAIModelSettings,
  saveModelProfileDraft
} from '@/app/ai/models/store'
import type { AIModelSettings } from '@/app/ai/models/types'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222'

let original: AIModelSettings

function settingsFixture(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-cloud',
        providerID: OPENPENCIL_AI_PROVIDER,
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'connection-cloud',
        cloudWorkspaceId: WORKSPACE_A
      }
    ],
    models: [
      {
        id: 'model-design',
        name: 'Design model',
        connectionId: 'connection-cloud',
        modelID: 'anthropic/claude-sonnet-5-5',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-design', review: 'design', fast: null, vision: null }
  }
}

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settingsFixture())
})

afterEach(() => {
  replaceAIModelSettings(original)
})

describe('OpenPencil Cloud model connections', () => {
  test('keep the workspace that pays for them through a save and a reload', () => {
    expect(parseAIModelSettings(settingsFixture())?.connections[0]?.cloudWorkspaceId).toBe(
      WORKSPACE_A
    )
    const draft = createModelProfileDraft('model-design')
    expect(draft.cloudWorkspaceId).toBe(WORKSPACE_A)
  })

  test('share a connection within a workspace and use another for a second workspace', () => {
    const sameWorkspace = createModelProfileDraft()
    sameWorkspace.name = 'Fast model'
    sameWorkspace.modelID = 'google/gemini-3-flash'
    sameWorkspace.sourceConnectionId = null
    expect(saveModelProfileDraft(sameWorkspace).connectionId).toBe('connection-cloud')

    const otherWorkspace = createModelProfileDraft()
    otherWorkspace.name = 'Team model'
    otherWorkspace.modelID = 'google/gemini-3-flash'
    otherWorkspace.sourceConnectionId = null
    otherWorkspace.cloudWorkspaceId = WORKSPACE_B
    const saved = saveModelProfileDraft(otherWorkspace)
    expect(saved.connectionId).not.toBe('connection-cloud')
    expect(
      modelSettingsSnapshot().connections.find((connection) => connection.id === saved.connectionId)
    ).toMatchObject({ providerID: OPENPENCIL_AI_PROVIDER, cloudWorkspaceId: WORKSPACE_B })
  })
})

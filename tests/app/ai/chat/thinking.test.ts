import { afterEach, beforeEach, expect, test } from 'bun:test'

import { agentSessionEfforts, chatAgentEfforts } from '@/app/ai/chat/thinking'
import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  setModelRoleAssignment,
  type AIModelSettings
} from '@/app/ai/models'

const EFFORTS = { current: 'max', values: [{ id: 'max', name: 'Max' }] }

let original: AIModelSettings

/** Two Claude Code profiles, which may run models that offer different efforts. */
function settings(): AIModelSettings {
  const profile = (id: `model-${string}`, modelID: string) => ({
    id,
    name: id,
    connectionId: 'connection-claude',
    modelID,
    customModelID: '',
    maxOutputTokens: 16384,
    thinkingLevel: 'default' as const,
    capabilities: ['tools' as const]
  })
  return {
    version: 1,
    connections: [
      {
        id: 'connection-claude',
        providerID: 'acp:claude-code',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: ''
      }
    ],
    models: [profile('model-opus', 'opus'), profile('model-haiku', 'haiku')],
    assignments: { design: 'model-opus', review: 'design', fast: 'design', vision: null }
  }
}

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settings())
})

afterEach(() => {
  agentSessionEfforts.value = null
  replaceAIModelSettings(original)
})

test('the composer offers a session’s efforts only for the profile it started from', () => {
  agentSessionEfforts.value = { profileId: 'model-opus', efforts: EFFORTS }
  expect(chatAgentEfforts.value).toEqual(EFFORTS)
  setModelRoleAssignment('design', 'model-haiku')
  expect(chatAgentEfforts.value).toBeNull()
})

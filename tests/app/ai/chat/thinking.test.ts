import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  agentSessionChoices,
  chatAgentChoices,
  chatAgentDefaults,
  chatAgentOptions,
  chooseAgentOption,
  chooseAgentOptions
} from '@/app/ai/chat/thinking'
import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  setModelRoleAssignment,
  type AIModelSettings
} from '@/app/ai/models'

const OFFERED = {
  thought_level: { name: 'Effort', current: 'max', values: [{ id: 'max', name: 'Max' }] },
  mode: { name: 'Mode', current: 'auto', values: [] }
}

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
  agentSessionChoices.value = null
  replaceAIModelSettings(original)
})

test('the composer offers a session’s options only for the profile it started from', () => {
  agentSessionChoices.value = {
    profileId: 'model-opus',
    modelID: 'opus',
    choices: OFFERED,
    defaults: {}
  }
  // An option with no values to choose from is left out.
  expect(chatAgentOptions.value).toEqual({ thought_level: OFFERED.thought_level })
  // Haiku's options were never read, so it offers none until its own session reports them.
  setModelRoleAssignment('design', 'model-haiku')
  expect(chatAgentOptions.value).toBeNull()
})

test('the composer drops a session’s options once its profile runs another model', () => {
  agentSessionChoices.value = {
    profileId: 'model-opus',
    modelID: 'opus',
    choices: OFFERED,
    defaults: { thought_level: 'max' }
  }
  const [opus, haiku] = settings().models
  replaceAIModelSettings({ ...settings(), models: [{ ...opus, modelID: 'sonnet' }, haiku] })
  expect(chatAgentOptions.value).toBeNull()
  expect(chatAgentDefaults.value).toEqual({})
})

test('the composer’s choices go over the profile’s, for the profile they were made for', () => {
  const [opus, haiku] = settings().models
  replaceAIModelSettings({
    ...settings(),
    models: [{ ...opus, agentChoices: { thought_level: 'low', mode: 'auto' } }, haiku]
  })
  chooseAgentOption('mode', 'plan')
  expect(chatAgentChoices.value).toEqual({ thought_level: 'low', mode: 'plan' })
  setModelRoleAssignment('design', 'model-haiku')
  expect(chatAgentChoices.value).toEqual({})
})

test('another model drops the composer’s effort for its profile, and keeps its modes', () => {
  chooseAgentOptions({ thought_level: 'max', mode: 'plan' })
  const [opus, haiku] = settings().models
  replaceAIModelSettings({ ...settings(), models: [{ ...opus, modelID: 'sonnet' }, haiku] })
  expect(chatAgentChoices.value).toEqual({ mode: 'plan' })
})

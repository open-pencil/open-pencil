import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelSettings
} from '@/app/ai/models'
import { existingOnboardingConnection } from '@/app/ai/models/settings/onboarding/connections'

let original: AIModelSettings

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings({
    version: 1,
    connections: [
      {
        id: 'connection-proxy',
        providerID: 'openai-compatible',
        customBaseURL: 'https://proxy.example/v1',
        customAPIType: 'responses',
        credentialProfileId: 'connection-proxy'
      },
      {
        id: 'connection-openai',
        providerID: 'openai',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'connection-openai'
      }
    ],
    models: [
      {
        id: 'model-proxy',
        name: 'Proxy',
        connectionId: 'connection-proxy',
        modelID: '',
        customModelID: 'team/design',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-proxy', review: null, fast: null, vision: null }
  })
})

afterEach(() => replaceAIModelSettings(original))

describe('existingOnboardingConnection', () => {
  test('matches a server only at the address being entered', () => {
    expect(existingOnboardingConnection('openai-compatible')?.id).toBe('connection-proxy')
    expect(
      existingOnboardingConnection('openai-compatible', ' https://proxy.example/v1 ')?.id
    ).toBe('connection-proxy')
    expect(existingOnboardingConnection('openai-compatible', 'http://localhost:11434/v1')).toBe(
      null
    )
  })

  test('matches an API account only without a custom address', () => {
    expect(existingOnboardingConnection('openai')?.id).toBe('connection-openai')
    expect(existingOnboardingConnection('anthropic')).toBeNull()
  })
})

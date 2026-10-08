import { describe, expect, test } from 'bun:test'

import { parseAIModelSettings } from '@/app/ai/models/store'
import type { AIModelConnection } from '@/app/ai/models/types'

const connection = {
  id: 'connection-a',
  providerID: 'openrouter',
  customBaseURL: '',
  customAPIType: 'completions',
  credentialProfileId: 'default'
} satisfies AIModelConnection

const profile = {
  id: 'model-a',
  name: 'Design',
  connectionId: 'connection-a',
  modelID: 'custom/model',
  customModelID: '',
  maxOutputTokens: 16_384,
  thinkingLevel: 'default',
  capabilities: ['tools']
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    connections: [connection],
    models: [profile],
    assignments: { design: 'model-a', review: 'design', fast: null, vision: null },
    ...overrides
  }
}

describe('parseAIModelSettings', () => {
  test('rejects settings it cannot use', () => {
    for (const stored of [null, 'settings', { ...settings(), version: 2 }]) {
      expect(parseAIModelSettings(stored)).toBeNull()
    }
    expect(parseAIModelSettings(settings({ models: [] }))).toBeNull()
  })

  test('drops connections and models that are malformed or point nowhere', () => {
    const parsed = parseAIModelSettings(
      settings({
        connections: [
          connection,
          { ...connection, id: 'connection-b', providerID: 'unknown-provider' },
          { ...connection, id: '' },
          'connection'
        ],
        models: [
          profile,
          { ...profile, id: 'model-b', connectionId: 'connection-b' },
          { ...profile, id: 'profile-c' },
          null
        ]
      })
    )
    expect(parsed?.connections.map((candidate) => candidate.id)).toEqual(['connection-a'])
    expect(parsed?.models.map((candidate) => candidate.id)).toEqual(['model-a'])
  })

  test('fills and bounds the fields of a stored model', () => {
    const parsed = parseAIModelSettings(
      settings({
        connections: [{ ...connection, customAPIType: 'soap', customBaseURL: 7 }],
        models: [
          {
            id: 'model-a',
            connectionId: 'connection-a',
            maxOutputTokens: 1_000_000,
            harnessPermissionMode: 'everything',
            capabilities: ['vision', 'tools', 'vision', 'audio']
          }
        ]
      })
    )
    expect(parsed?.connections[0]).toEqual({
      ...connection,
      customBaseURL: '',
      customAPIType: 'completions'
    })
    expect(parsed?.models[0]).toEqual({
      id: 'model-a',
      name: 'Model',
      connectionId: 'connection-a',
      modelID: '',
      customModelID: '',
      maxOutputTokens: 128_000,
      thinkingLevel: 'default',
      harnessPermissionMode: undefined,
      capabilities: ['vision', 'tools']
    })
  })

  test('assigns roles only to models that can take them', () => {
    const parsed = parseAIModelSettings(
      settings({
        models: [profile, { ...profile, id: 'model-b', capabilities: ['tools', 'vision'] }],
        assignments: {
          design: 'model-missing',
          review: 'model-b',
          fast: 'model-x',
          vision: 'design'
        }
      })
    )
    expect(parsed?.assignments).toEqual({
      design: 'model-a',
      review: 'model-b',
      fast: null,
      vision: null
    })
  })
})

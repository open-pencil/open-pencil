import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveModelConnectionAPIKey,
  setModelConnectionAPIKey,
  type AIModelSettings
} from '@/app/ai/models'
import {
  existingOnboardingConnection,
  useOnboardingConnections
} from '@/app/ai/models/settings/onboarding/connections'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { CredentialStoreError } from '@/app/settings/credentials/types'

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

const CURSOR_CONNECTION = 'connection-cursor'

function cursorSettings(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: CURSOR_CONNECTION,
        providerID: 'acp:cursor',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'cursor-main'
      }
    ],
    models: [],
    assignments: { design: 'model-cursor', review: null, fast: null, vision: null }
  }
}

async function savedCursorKey(connections: ReturnType<typeof useOnboardingConnections>) {
  connections.hasSavedKey('acp:cursor')
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (connections.hasSavedKey('acp:cursor')) return
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  throw new Error('saved key status did not load')
}

describe('clearSavedKey', () => {
  test('removes a saved key without waiting for setup to finish', async () => {
    replaceAIModelSettings(cursorSettings())
    await setModelConnectionAPIKey(CURSOR_CONNECTION, 'user-key')
    try {
      const connections = useOnboardingConnections({ plannedModel: () => null })
      await savedCursorKey(connections)

      await connections.clearSavedKey('acp:cursor')

      expect(connections.hasSavedKey('acp:cursor')).toBe(false)
      expect(connections.connection('acp:cursor').apiKey).toBe('')
      expect(connections.connection('acp:cursor').keyError).toBeNull()
      expect(await resolveModelConnectionAPIKey(CURSOR_CONNECTION)).toBeNull()
    } finally {
      await setModelConnectionAPIKey(CURSOR_CONNECTION, '')
    }
  })

  test('keeps a saved key when removing it fails', async () => {
    replaceAIModelSettings(cursorSettings())
    await setModelConnectionAPIKey(CURSOR_CONNECTION, 'user-key')
    const clear = spyOn(appCredentialServices.manager, 'clear').mockRejectedValue(
      new CredentialStoreError('locked', 'locked')
    )
    try {
      const connections = useOnboardingConnections({ plannedModel: () => null })
      await savedCursorKey(connections)
      await connections.clearSavedKey('acp:cursor')
      expect(connections.hasSavedKey('acp:cursor')).toBe(true)
      expect(connections.connection('acp:cursor').keyError).toBe('clear-failed')
      expect(await resolveModelConnectionAPIKey(CURSOR_CONNECTION)).toBe('user-key')
    } finally {
      clear.mockRestore()
      await setModelConnectionAPIKey(CURSOR_CONNECTION, '')
    }
  })
})

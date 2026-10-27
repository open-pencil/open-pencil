import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { agentProcessEnv } from '@/app/ai/agents/acp/env'
import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  setModelConnectionAPIKey,
  type AIModelSettings
} from '@/app/ai/models'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { CredentialStoreError } from '@/app/settings/credentials/types'

import { expectDefined } from '#tests/helpers/assert'

const cursor = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'cursor'),
  'Cursor'
)
const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude Code'
)

/** The design connection is the second Cursor connection, so a first-match would pick the other. */
function settings(design: 'cursor' | 'anthropic'): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-other-cursor',
        providerID: 'acp:cursor',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'cursor-other'
      },
      {
        id: 'connection-cursor',
        providerID: 'acp:cursor',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'cursor-main'
      },
      {
        id: 'connection-anthropic',
        providerID: 'anthropic',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'anthropic-main'
      }
    ],
    models: [
      {
        id: 'model-cursor',
        name: 'Cursor',
        connectionId: 'connection-cursor',
        modelID: '',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      },
      {
        id: 'model-anthropic',
        name: 'Anthropic',
        connectionId: 'connection-anthropic',
        modelID: 'claude-sonnet-5-5',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools', 'vision']
      }
    ],
    assignments: {
      design: design === 'cursor' ? 'model-cursor' : 'model-anthropic',
      review: null,
      fast: null,
      vision: null
    }
  }
}

let original: AIModelSettings

beforeEach(() => {
  original = modelSettingsSnapshot()
})

afterEach(async () => {
  await setModelConnectionAPIKey('connection-cursor', '')
  await setModelConnectionAPIKey('connection-other-cursor', '')
  replaceAIModelSettings(original)
})

describe('agent process environment', () => {
  test('passes the saved key of the Cursor design agent and leaves the command line alone', async () => {
    replaceAIModelSettings(settings('cursor'))
    await setModelConnectionAPIKey('connection-other-cursor', 'other-key')
    await setModelConnectionAPIKey('connection-cursor', 'design-key')

    expect(await agentProcessEnv(cursor)).toEqual({ CURSOR_API_KEY: 'design-key' })
    expect([cursor.command, ...cursor.args]).toEqual(['agent', 'acp'])
    expect(await agentProcessEnv(claude)).toEqual({})
  })

  test('uses a Cursor connection when the design agent is not Cursor', async () => {
    replaceAIModelSettings(settings('anthropic'))
    await setModelConnectionAPIKey('connection-other-cursor', 'other-key')

    expect(await agentProcessEnv(cursor)).toEqual({ CURSOR_API_KEY: 'other-key' })
  })

  test('starts Cursor without a key when none is saved', async () => {
    replaceAIModelSettings(settings('cursor'))

    expect(await agentProcessEnv(cursor)).toEqual({})
  })

  test('does not read a key the store cannot confirm', async () => {
    replaceAIModelSettings(settings('cursor'))
    const resolve = spyOn(appCredentialServices.resolver, 'resolve')
    const status = spyOn(appCredentialServices.manager, 'status')
    try {
      for (const value of ['missing', 'locked', 'unavailable'] as const) {
        resolve.mockClear()
        status.mockResolvedValue(value)
        expect(await agentProcessEnv(cursor)).toEqual({})
        expect(resolve).not.toHaveBeenCalled()
      }
      status.mockRejectedValue(new Error('credential store unavailable'))
      expect(await agentProcessEnv(cursor)).toEqual({})
      expect(resolve).not.toHaveBeenCalled()
    } finally {
      status.mockRestore()
      resolve.mockRestore()
    }
  })

  test('reports a saved key that cannot be read', async () => {
    replaceAIModelSettings(settings('cursor'))
    const status = spyOn(appCredentialServices.manager, 'status').mockResolvedValue('configured')
    const resolve = spyOn(appCredentialServices.resolver, 'resolve').mockRejectedValue(
      new CredentialStoreError('locked', 'locked')
    )
    try {
      await expect(agentProcessEnv(cursor)).rejects.toBeInstanceOf(CredentialStoreError)
      expect(resolve).toHaveBeenCalled()
    } finally {
      status.mockRestore()
      resolve.mockRestore()
    }
  })
})

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { shallowRef } from 'vue'

import type { ServiceCatalog } from '@open-pencil/cloud/contract'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveAIModelRole
} from '@/app/ai/models/store'
import type { AIModelSettings } from '@/app/ai/models/types'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { catalogRoleModels, setUpCloudAI } from '@/app/ai/providers/openpencil/setup'
import type { CloudAISource } from '@/app/ai/providers/openpencil/source'

const WORKSPACE = '11111111-1111-4111-8111-111111111111'
const SONNET = 'anthropic/claude-sonnet-5.5'
const HAIKU = 'anthropic/claude-haiku-5.5'

const CATALOG: ServiceCatalog = {
  models: [
    {
      id: SONNET,
      label: 'Claude Sonnet 5.5',
      creditsPerMillionInputTokens: 2858,
      creditsPerMillionOutputTokens: 14286,
      contextTokens: 1_000_000,
      capabilities: { reasoning: true, vision: true, tools: true }
    },
    {
      id: HAIKU,
      label: 'Claude Haiku 5.5',
      creditsPerMillionInputTokens: 143,
      creditsPerMillionOutputTokens: 715,
      contextTokens: 1_000_000,
      capabilities: { reasoning: true, vision: true, tools: true }
    }
  ],
  defaultModelID: SONNET,
  roleModels: { design: SONNET, review: SONNET, fast: HAIKU, vision: SONNET }
}

/** A fresh install's settings: one Design model on a compatible server with no address. */
function freshInstall(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-default',
        providerID: 'openai-compatible',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'default'
      }
    ],
    models: [
      {
        id: 'model-default',
        name: 'Design model',
        connectionId: 'connection-default',
        modelID: '',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-default', review: 'design', fast: 'design', vision: null }
  }
}

function cloud(
  catalog: ServiceCatalog = CATALOG,
  workspaces = [{ id: WORKSPACE, name: 'Studio' }]
) {
  const identity = shallowRef<string | null>('server:account-1')
  const source: CloudAISource = {
    identity,
    workspaces: async () => workspaces,
    client: () => ({ catalog: async () => catalog })
  }
  return { identity, source }
}

let original: AIModelSettings

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(freshInstall())
})

afterEach(() => {
  replaceAIModelSettings(original)
})

describe('setting Cloud AI up on sign-in', () => {
  test('gives every role the model the catalog recommends, paid by a workspace with AI', async () => {
    expect(await setUpCloudAI(cloud().source)).toBe(true)

    const design = resolveAIModelRole('design')
    expect(design?.connection).toMatchObject({
      providerID: OPENPENCIL_AI_PROVIDER,
      cloudWorkspaceId: WORKSPACE
    })
    expect(design?.profile).toMatchObject({ name: 'Claude Sonnet 5.5', modelID: SONNET })
    expect(resolveAIModelRole('review')?.profile.modelID).toBe(SONNET)
    expect(resolveAIModelRole('fast')?.profile.modelID).toBe(HAIKU)
    expect(resolveAIModelRole('vision')?.profile.modelID).toBe(SONNET)
    // The fresh install's unset model is gone, so nothing is left to set up.
    expect(modelSettingsSnapshot().models.map((profile) => profile.modelID)).toEqual([
      SONNET,
      HAIKU
    ])
  })

  test('leaves a model the person set up alone', async () => {
    const settings = freshInstall()
    const [connection] = settings.connections
    if (connection) connection.customBaseURL = 'https://models.example.com/v1'
    replaceAIModelSettings(settings)

    expect(await setUpCloudAI(cloud().source)).toBe(false)
    expect(modelSettingsSnapshot()).toEqual(settings)
  })

  test('does nothing for an account whose plan includes no AI', async () => {
    expect(await setUpCloudAI(cloud(CATALOG, []).source)).toBe(false)
    expect(modelSettingsSnapshot()).toEqual(freshInstall())
  })

  test('drops an answer that comes after another account signed in', async () => {
    const { identity, source } = cloud()
    const late: CloudAISource = {
      ...source,
      client: () => ({
        catalog: async () => {
          identity.value = 'server:account-2'
          return CATALOG
        }
      })
    }
    expect(await setUpCloudAI(late)).toBe(false)
    expect(modelSettingsSnapshot()).toEqual(freshInstall())
  })
})

describe('catalogRoleModels', () => {
  test("uses a service's default model for every role when it recommends none", () => {
    const { roleModels: _recommended, ...older } = CATALOG
    expect(catalogRoleModels(older)).toEqual({
      design: SONNET,
      review: SONNET,
      fast: SONNET,
      vision: SONNET
    })
    const textOnly: ServiceCatalog = {
      ...older,
      models: older.models.map((model) => ({
        ...model,
        capabilities: { ...model.capabilities, vision: false }
      }))
    }
    expect(catalogRoleModels(textOnly).vision).toBeNull()
  })
})

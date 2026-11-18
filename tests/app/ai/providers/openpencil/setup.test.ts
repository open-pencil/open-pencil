import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { shallowRef, watch } from 'vue'

import type { ServiceCatalog } from '@open-pencil/cloud/contract'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveAIModelRole
} from '@/app/ai/models/store'
import type { AIModelSettings } from '@/app/ai/models/types'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import {
  catalogRoleModels,
  setUpCloudAI,
  watchCloudAISetup
} from '@/app/ai/providers/openpencil/setup'
import type { CloudAISource } from '@/app/ai/providers/openpencil/source'
import { createDeferred } from '@/app/runtime/deferred'

import { freshInstallModelSettings } from '#tests/helpers/ai/settings'

const WORKSPACE = '11111111-1111-4111-8111-111111111111'
const SONNET = 'anthropic/claude-sonnet-5.5'
const HAIKU = 'anthropic/claude-haiku-5.5'

/** Prices and context sizes the setup never reads; any value does. */
const UNUSED = {
  creditsPerMillionInputTokens: 1,
  creditsPerMillionOutputTokens: 1,
  contextTokens: 1
}

const CATALOG: ServiceCatalog = {
  models: [
    {
      ...UNUSED,
      id: SONNET,
      label: 'Claude Sonnet 5.5',
      capabilities: { reasoning: true, vision: true, tools: true }
    },
    {
      ...UNUSED,
      id: HAIKU,
      label: 'Claude Haiku 5.5',
      capabilities: { reasoning: true, vision: true, tools: true }
    }
  ],
  defaultModelID: SONNET,
  roleModels: { design: SONNET, review: SONNET, fast: HAIKU, vision: SONNET }
}

const freshInstall = freshInstallModelSettings

function cloud(
  catalog: ServiceCatalog = CATALOG,
  workspaces = [{ id: WORKSPACE, name: 'Studio' }]
) {
  const identity = shallowRef<string | null>('server:account-1')
  const source: CloudAISource = {
    identity,
    workspaces: async () => workspaces,
    firstWorkspace: async () => workspaces.at(0) ?? null,
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

  test('keeps a role the person already changed, such as Fast tasks turned off', async () => {
    const settings = freshInstall()
    settings.assignments.fast = null
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

/** Resolves once the Design model is `modelID`, however long the watcher takes to get there. */
function designBecomes(modelID: string): Promise<void> {
  return new Promise((resolve) => {
    const stop = watch(
      () => resolveAIModelRole('design')?.profile.modelID,
      (id) => {
        if (id !== modelID) return
        stop()
        resolve()
      },
      { immediate: true }
    )
  })
}

describe('watching for sign-ins', () => {
  test('tries a failed setup again while the same account stays signed in', async () => {
    const { source } = cloud()
    let failures = 1
    const flaky: CloudAISource = {
      ...source,
      client: () => ({
        catalog: async () => {
          if (failures-- > 0) throw new Error('The server is out of reach')
          return CATALOG
        }
      })
    }
    const stop = watchCloudAISetup(flaky, [0])
    try {
      await designBecomes(SONNET)
      expect(failures).toBe(-1)
    } finally {
      stop()
    }
  })

  test('writes nothing for an answer that arrives after it stopped', async () => {
    const { source } = cloud()
    const answer = createDeferred<ServiceCatalog>()
    const slow: CloudAISource = { ...source, client: () => ({ catalog: () => answer.promise }) }
    const stop = watchCloudAISetup(slow, [])
    stop()
    answer.resolve(CATALOG)
    await answer.promise
    await Promise.resolve()

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

import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, reactive, ref, type EffectScope } from 'vue'

import type { AICatalog } from '@open-pencil/cloud/contract'

import {
  useCloudModelSelection,
  type CloudModelSource
} from '@/app/ai/models/settings/profile-editor/cloud'
import { createModelProfileDraft } from '@/app/ai/models/store'
import type { AIModelProfileDraft } from '@/app/ai/models/types'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import type { CloudAIWorkspace } from '@/app/cloud/integration'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

const ALICE = 'home:alice'
const BOB = 'home:bob'

function catalog(modelID: string): AICatalog {
  return {
    defaultModelID: modelID,
    models: [
      {
        id: modelID,
        label: modelID,
        creditsPerMillionInputTokens: 1,
        creditsPerMillionOutputTokens: 1,
        contextTokens: 1000,
        capabilities: { reasoning: false, vision: false, tools: true }
      }
    ]
  }
}

/** A Home server whose workspace lists and catalogs answer when the test says so. */
function homeCloud() {
  const identity = ref<string | null>(ALICE)
  const workspaceAnswers: Deferred<CloudAIWorkspace[]>[] = []
  const catalogAnswers: Deferred<AICatalog>[] = []
  const source: CloudModelSource = {
    identity,
    workspaces: () => {
      const next = createDeferred<CloudAIWorkspace[]>()
      workspaceAnswers.push(next)
      return next.promise
    },
    client: () => ({
      catalog: () => {
        const next = createDeferred<AICatalog>()
        catalogAnswers.push(next)
        return next.promise
      }
    })
  }
  return { identity, source, workspaceAnswers, catalogAnswers }
}

const scopes: EffectScope[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function select(source: CloudModelSource) {
  const draft = reactive(createModelProfileDraft())
  draft.providerID = OPENPENCIL_AI_PROVIDER
  return selectDraft(draft, source)
}

function selectDraft(draft: AIModelProfileDraft, source: CloudModelSource) {
  const scope = effectScope()
  scopes.push(scope)
  const selection = scope.run(() =>
    useCloudModelSelection(
      draft,
      (modelID) => {
        draft.modelID = modelID
      },
      source
    )
  )
  if (!selection) throw new Error('selection was not created')
  return { draft, selection }
}

async function settle(): Promise<void> {
  await nextTick()
  await Promise.resolve()
}

describe('useCloudModelSelection', () => {
  test("drops an earlier account's workspaces after switching accounts", async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.identity.value = BOB
    await settle()

    home.workspaceAnswers[1]?.resolve([{ id: 'bob-team', name: 'Bob' }])
    await settle()
    home.workspaceAnswers[0]?.resolve([{ id: 'alice-team', name: 'Alice' }])
    await settle()

    expect(editor.selection.workspaces.value.map((workspace) => workspace.id)).toEqual(['bob-team'])
    expect(editor.draft.cloudWorkspaceId).toBe('bob-team')
  })

  test('stays unavailable when the workspace list arrives after signing out', async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.identity.value = null
    await settle()

    home.workspaceAnswers[0]?.resolve([{ id: 'alice-team', name: 'Alice' }])
    await settle()

    expect(editor.selection.state.value).toBe('unavailable')
    expect(editor.selection.workspaces.value).toEqual([])
  })

  test('keeps the newest catalog when an earlier one answers last', async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.workspaceAnswers[0]?.resolve([{ id: 'alice-team', name: 'Alice' }])
    await settle()
    home.catalogAnswers[0]?.reject(new Error('offline'))
    await settle()
    expect(editor.selection.state.value).toBe('catalog-failed')

    editor.selection.retry()
    await settle()
    expect(editor.selection.state.value).toBe('ready')
    editor.selection.retry()
    await settle()
    home.catalogAnswers[2]?.resolve(catalog('newest'))
    await settle()
    home.catalogAnswers[1]?.resolve(catalog('older'))
    await settle()

    expect(editor.selection.models.value.map((model) => model.id)).toEqual(['newest'])
    expect(editor.draft.modelID).toBe('newest')
  })

  test('drops a catalog that answers after signing out', async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.workspaceAnswers[0]?.resolve([{ id: 'team', name: 'Team' }])
    await settle()
    home.identity.value = null
    await settle()

    home.catalogAnswers[0]?.resolve(catalog('stale'))
    await settle()

    expect(editor.selection.state.value).toBe('unavailable')
    expect(editor.selection.models.value).toEqual([])
  })

  test('lists the models again for another account on the same workspace', async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.workspaceAnswers[0]?.resolve([{ id: 'team', name: 'Team' }])
    await settle()
    home.identity.value = BOB
    await settle()
    home.workspaceAnswers[1]?.resolve([{ id: 'team', name: 'Team' }])
    await settle()

    home.catalogAnswers[1]?.resolve(catalog('bob-model'))
    await settle()
    home.catalogAnswers[0]?.resolve(catalog('alice-model'))
    await settle()

    expect(editor.selection.models.value.map((model) => model.id)).toEqual(['bob-model'])
  })

  test('offers a retry when the workspaces could not be checked', async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.workspaceAnswers[0]?.reject(new Error('offline'))
    await settle()
    expect(editor.selection.state.value).toBe('workspaces-failed')

    editor.selection.retry()
    await settle()
    home.workspaceAnswers[1]?.resolve([{ id: 'team', name: 'Team' }])
    await settle()

    expect(editor.selection.state.value).toBe('ready')
    expect(editor.draft.cloudWorkspaceId).toBe('team')
  })

  test('keeps a catalog failure for a saved workspace when the list arrives later', async () => {
    const home = homeCloud()
    const draft = reactive(createModelProfileDraft())
    draft.providerID = OPENPENCIL_AI_PROVIDER
    draft.cloudWorkspaceId = 'team'
    const editor = selectDraft(draft, home.source)
    home.catalogAnswers[0]?.reject(new Error('offline'))
    await settle()
    home.workspaceAnswers[0]?.resolve([{ id: 'team', name: 'Team' }])
    await settle()

    expect(editor.selection.state.value).toBe('catalog-failed')
  })

  test("hides an earlier account's workspaces while the next one's load or fail", async () => {
    const home = homeCloud()
    const editor = select(home.source)
    home.workspaceAnswers[0]?.resolve([{ id: 'alice-team', name: 'Alice' }])
    await settle()

    home.identity.value = BOB
    await settle()
    expect(editor.selection.workspaces.value).toEqual([])

    home.workspaceAnswers[1]?.reject(new Error('offline'))
    await settle()
    expect(editor.selection.state.value).toBe('workspaces-failed')
    expect(editor.selection.workspaces.value).toEqual([])
    expect(editor.draft.cloudWorkspaceId).toBe('alice-team')
  })
})

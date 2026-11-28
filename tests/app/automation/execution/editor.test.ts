import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { executeWithDocumentUndo } from '@/app/automation/execution/editor'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'
import { createDeferred } from '@/app/runtime/deferred'

let store: EditorStore

beforeEach(() => {
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
  store = createEditorStore(new SceneGraph())
})

afterEach(() => {
  store.dispose()
  Reflect.deleteProperty(globalThis, 'window')
})

test('undoing an automation edit that awaits returns the document to saved', async () => {
  const pageId = store.state.currentPageId
  store.markDocumentSaved()

  await executeWithDocumentUndo(store, pageId, 'Agent: eval', async () => {
    await Promise.resolve()
    store.graph.createNode('RECTANGLE', pageId, { width: 40, height: 20 })
    await Promise.resolve()
  })
  await Promise.resolve()
  expect(store.hasUnsavedChanges()).toBe(true)

  expect(store.undo.undo()).toBe('Agent: eval')
  await Promise.resolve()
  expect(store.graph.getChildren(pageId)).toEqual([])
  expect(store.hasUnsavedChanges()).toBe(false)
})

test('overlapping agent font loads keep existing artwork visible', async () => {
  const { graph } = store
  const pageId = store.state.currentPageId
  const frames = Array.from({ length: 3 }, () => graph.createNode('FRAME', pageId))
  const existing = graph.createNode('TEXT', frames[0].id, { text: 'Existing label' })
  const started = createDeferred<undefined>()
  const releaseFonts = createDeferred<Record<string, string[]>>()
  let loading = 0
  const load = spyOn(fontManager, 'ensureFallbackPack').mockImplementation(() => {
    if (++loading === frames.length) started.resolve(undefined)
    return releaseFonts.promise
  })
  const calls = frames.map((frame, index) =>
    executeWithDocumentUndo(store, pageId, 'Agent: eval', async () =>
      graph.createNode('TEXT', frame.id, { text: `New label ${index}` })
    )
  )

  try {
    await started.promise
    expect(frames.map(({ id }) => fontManager.isNodeBlocked(graph, id))).toEqual([
      false,
      false,
      false
    ])
    expect(fontManager.isNodeBlocked(graph, existing.id)).toBe(false)
    for (const frame of frames) {
      expect(fontManager.isNodeBlocked(graph, frame.childIds.at(-1) ?? '')).toBe(true)
    }
  } finally {
    releaseFonts.resolve({})
    await Promise.allSettled(calls)
    load.mockRestore()
  }

  for (const node of await Promise.all(calls)) {
    expect(fontManager.isNodeBlocked(graph, node.id)).toBe(false)
  }
})

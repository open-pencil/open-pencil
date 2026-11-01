import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

import { Run } from '@/app/ai/reply/run'
import { DEFAULT_AGENT_STEPS } from '@/app/ai/reply/step-limit'
import { readToolChange } from '@/app/ai/tools/changes/store'
import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'

let store: EditorStore

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window.
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
  store = createEditorStore(new SceneGraph())
})

afterEach(() => {
  store.dispose()
  Reflect.deleteProperty(globalThis, 'window')
})

test('a call cancelled while it waits for its turn edits nothing', async () => {
  const createShape = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
    'create_shape'
  )
  const pageId = store.state.currentPageId
  const figma = makeFigmaFromStore(store, pageId)
  // A first edit holds the document's lock until the test lets it finish.
  const held = createDeferred<undefined>()
  const first = runEditorTool({
    store,
    figma,
    def: { ...createShape, execute: () => held.promise },
    args: {},
    source: 'WebMCP'
  })
  const cancel = new AbortController()
  const queued = runEditorTool({
    store,
    figma,
    def: createShape,
    args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 },
    source: 'WebMCP',
    signal: cancel.signal
  })
  cancel.abort()
  held.resolve(undefined)

  await first
  await expect(queued).rejects.toThrow()
  expect(store.graph.getChildren(pageId)).toEqual([])
  expect(store.undo.peekUndo()).toBeUndefined()
})

test('undoing an asynchronous tool call returns the document to saved', async () => {
  const tool = (name: string) =>
    expectDefined(
      ALL_TOOLS.find((candidate) => candidate.name === name),
      name
    )
  const pageId = store.state.currentPageId
  const figma = makeFigmaFromStore(store, pageId)
  const ids = [0, 20, 40].map(
    (x) => store.graph.createNode('RECTANGLE', pageId, { x, y: x / 2, width: 100, height: 70 }).id
  )
  store.markDocumentSaved()

  await runEditorTool({ store, figma, def: tool('arrange'), args: { ids }, source: 'MCP' })
  await Promise.resolve()
  expect(store.hasUnsavedChanges()).toBe(true)

  store.undo.undo()
  await Promise.resolve()
  expect(store.hasUnsavedChanges()).toBe(false)
})

test("a reply's property edit is recorded once, as one undo entry", async () => {
  const setOpacity = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'set_opacity'),
    'set_opacity'
  )
  const pageId = store.state.currentPageId
  const figma = makeFigmaFromStore(store, pageId)
  const rect = store.graph.createNode('RECTANGLE', pageId, { width: 100, height: 70 })
  const run = new Run(DEFAULT_AGENT_STEPS, pageId, false)
  // The atomic tool records its own step; nothing captures the document around it again.
  const recordEdit = spyOn(store, 'recordEdit')
  const recordEditAsync = spyOn(store, 'recordEditAsync')

  await runEditorTool({
    store,
    figma,
    def: setOpacity,
    args: { id: rect.id, value: 0.5 },
    reply: { run, toolCallId: 'call-1' }
  })

  expect(store.graph.getNode(rect.id)?.opacity).toBe(0.5)
  expect(recordEdit).not.toHaveBeenCalled()
  expect(recordEditAsync).not.toHaveBeenCalled()
  expect(store.undo.peekUndo()?.label).toBe('AI: set_opacity')
  expect(run.undoCalls.map(({ toolCallId }) => toolCallId)).toEqual(['call-1'])
  expect(run.changedCalls.has('call-1')).toBe(true)
  expect(readToolChange('call-1')).not.toBeNull()
  store.undo.undo()
  expect(store.graph.getNode(rect.id)?.opacity).toBe(1)
  expect(store.undo.canUndo).toBe(false)
})

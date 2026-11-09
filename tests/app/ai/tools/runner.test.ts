import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import type { IconData } from '@open-pencil/core/icons'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { Run } from '@/app/ai/reply/run'
import { DEFAULT_AGENT_STEPS } from '@/app/ai/reply/step-limit'
import { readToolChange } from '@/app/ai/tools/changes/store'
import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import * as fonts from '@/app/editor/fonts'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'
import { createDeferred } from '@/app/runtime/deferred'
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
  // It stops at once, without waiting for its turn.
  await expect(queued).rejects.toThrow()
  held.resolve(undefined)
  await first
  expect(store.graph.getChildren(pageId)).toEqual([])
  expect(store.undo.peekUndo()).toBeUndefined()
})

test('a call cancelled while it runs is rolled back once it finishes', async () => {
  const createShape = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
    'create_shape'
  )
  const pageId = store.state.currentPageId
  const figma = makeFigmaFromStore(store, pageId)
  const downloaded = createDeferred<undefined>()
  const cancel = new AbortController()
  const call = runEditorTool({
    store,
    figma,
    def: {
      ...createShape,
      execute: async (api, args) => {
        const result = createShape.execute(api, args)
        await downloaded.promise
        return result
      }
    },
    args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 },
    source: 'MCP',
    signal: cancel.signal
  })
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  cancel.abort(new Error('timed out'))
  downloaded.resolve(undefined)

  await expect(call).rejects.toThrow('timed out')
  expect(store.graph.getChildren(pageId)).toEqual([])
  expect(store.undo.peekUndo()).toBeUndefined()
})

test('the next call edits while an earlier one still loads its fonts', async () => {
  const createShape = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
    'create_shape'
  )
  const pageId = store.state.currentPageId
  const figma = makeFigmaFromStore(store, pageId)
  const fontsLoaded = createDeferred<boolean>()
  const ensure = spyOn(fonts, 'ensureGraphFonts').mockReturnValueOnce(fontsLoaded.promise)
  const shape = { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 }
  try {
    const first = runEditorTool({ store, figma, def: createShape, args: shape, source: 'MCP' })
    const second = runEditorTool({ store, figma, def: createShape, args: shape, source: 'MCP' })

    await second
    expect(store.graph.getChildren(pageId)).toHaveLength(2)
    fontsLoaded.resolve(false)
    await first
  } finally {
    ensure.mockRestore()
  }
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

test("an edit made while a call's fonts load stays out of the call's undo step", async () => {
  const createShape = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
    'create_shape'
  )
  const pageId = store.state.currentPageId
  const card = store.graph.createNode('RECTANGLE', pageId, { width: 100, height: 70 })
  const fontsLoaded = createDeferred<boolean>()
  const loadFonts = spyOn(fonts, 'ensureGraphFonts').mockReturnValue(fontsLoaded.promise)

  const call = runEditorTool({
    store,
    figma: makeFigmaFromStore(store, pageId),
    def: createShape,
    args: { type: 'RECTANGLE', x: 200, y: 0, width: 40, height: 20 },
    source: 'MCP'
  })
  while (loadFonts.mock.calls.length === 0) await Promise.resolve()
  store.updateNodeWithUndo(card.id, { x: 25 }, 'Move')
  fontsLoaded.resolve(true)
  await call

  expect(store.undo.undo()).toBe('Move')
  expect(store.graph.getChildren(pageId)).toHaveLength(2)
  expect(store.undo.undo()).toBe('MCP: create_shape')
  expect(store.graph.getChildren(pageId).map((node) => node.id)).toEqual([card.id])
  expect(store.graph.getNode(card.id)?.x).toBe(0)
})

test("an edit made while a call downloads stays out of the call's undo step", async () => {
  const insertIcon = expectDefined(
    ALL_TOOLS.find((tool) => tool.name === 'insert_icon'),
    'insert_icon'
  )
  const pageId = store.state.currentPageId
  const card = store.graph.createNode('RECTANGLE', pageId, { width: 100, height: 70 })
  const figma = makeFigmaFromStore(store, pageId)
  const square: IconData = {
    prefix: 'test',
    name: 'square',
    width: 24,
    height: 24,
    paths: [
      {
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 24, y: 0 },
            { x: 24, y: 24 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
        },
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        tint: []
      }
    ]
  }
  const downloaded = createDeferred<Map<string, IconData>>()
  const download = spyOn(figma.icons, 'icons').mockReturnValue(downloaded.promise)

  const call = runEditorTool({
    store,
    figma,
    def: insertIcon,
    args: { name: 'test:square' },
    source: 'MCP'
  })
  while (download.mock.calls.length === 0) await Promise.resolve()
  store.updateNodeWithUndo(card.id, { x: 25 }, 'Move')
  downloaded.resolve(new Map([['test:square', square]]))
  await call

  expect(store.graph.getChildren(pageId)).toHaveLength(2)
  expect(store.undo.undo()).toBe('MCP: insert_icon')
  expect(store.graph.getChildren(pageId).map((node) => node.id)).toEqual([card.id])
  expect(store.graph.getNode(card.id)?.x).toBe(25)
  expect(store.undo.undo()).toBe('Move')
  expect(store.graph.getNode(card.id)?.x).toBe(0)
})

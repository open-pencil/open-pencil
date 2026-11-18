import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { acquireDocumentEdit } from '@/app/automation/execution/lock'
import { createDeferred } from '@/app/runtime/deferred'
import { createTab } from '@/app/tabs'

import {
  handleRequest,
  request,
  useAutomationHandlerGlobals
} from '#tests/helpers/automation/handlers'

useAutomationHandlerGlobals()

describe('eval beside a tool call', () => {
  test('waits for the call that holds the document and records its own step', async () => {
    const tab = createTab()
    const { store } = tab
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 200 })
    const createShape = expectDefined(
      ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
      'create_shape'
    )
    // The call holds the document's lock until the test lets it finish.
    const held = createDeferred<undefined>()
    const call = runEditorTool({
      store,
      figma: makeFigmaFromStore(store, pageId),
      def: {
        ...createShape,
        execute: async (figma, args) => {
          await held.promise
          return createShape.execute(figma, args)
        }
      },
      args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 },
      source: 'MCP'
    })
    const script = request('eval', {
      document_id: tab.id,
      code: "figma.currentPage.findOne((node) => node.name === 'Card').name = 'Renamed'"
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(store.graph.getNode(card.id)?.name).toBe('Card')

    held.resolve(undefined)
    await Promise.all([call, script])
    expect(store.graph.getChildren(pageId)).toHaveLength(2)
    expect(store.graph.getNode(card.id)?.name).toBe('Renamed')

    expect(store.undo.undo()).toBe('Agent: eval')
    expect(store.graph.getChildren(pageId)).toHaveLength(2)
    expect(store.graph.getNode(card.id)?.name).toBe('Card')
    expect(store.undo.undo()).toBe('MCP: create_shape')
    expect(store.graph.getChildren(pageId).map((node) => node.id)).toEqual([card.id])
  })
  test('a call cancelled while it waits for the document never runs', async () => {
    const tab = createTab()
    const { store } = tab
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 200 })
    // A script holds the document's lock until the test lets it finish.
    const held = createDeferred<undefined>()
    Reflect.set(globalThis, '__holdDocument', held.promise)
    const holder = request('eval', { document_id: tab.id, code: 'await globalThis.__holdDocument' })
    const cancel = new AbortController()
    const rename = handleRequest(
      store,
      'eval',
      {
        document_id: tab.id,
        code: "figma.currentPage.findOne((node) => node.name === 'Card').name = 'Renamed'"
      },
      cancel.signal
    )
    const next = request('eval', {
      document_id: tab.id,
      code: "figma.currentPage.findOne((node) => node.name === 'Card').visible = false"
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    cancel.abort(new Error('timed out'))
    await expect(rename).rejects.toThrow('timed out')
    held.resolve(undefined)
    await Promise.all([holder, next])
    Reflect.deleteProperty(globalThis, '__holdDocument')

    expect(store.graph.getNode(card.id)).toMatchObject({ name: 'Card', visible: false })
  })
})

describe('a failed call', () => {
  test('a script that throws part way leaves the document as it was', async () => {
    const tab = createTab()
    const { store } = tab
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 200 })

    await expect(
      request('eval', {
        document_id: tab.id,
        code: `
          figma.currentPage.findOne((node) => node.name === 'Card').name = 'Renamed'
          figma.currentPage.appendChild(figma.createRectangle())
          throw new Error('failed part way')
        `
      })
    ).rejects.toThrow('failed part way')

    expect(store.graph.getNode(card.id)?.name).toBe('Card')
    expect(store.graph.getChildren(pageId).map((node) => node.id)).toEqual([card.id])
    expect(store.undo.canUndo).toBe(false)
  })

  test('a tool that answers with an error after writing leaves the document as it was', async () => {
    const tab = createTab()
    const { store } = tab
    const pageId = store.state.currentPageId
    const createShape = expectDefined(
      ALL_TOOLS.find((tool) => tool.name === 'create_shape'),
      'create_shape'
    )

    const result = await runEditorTool({
      store,
      figma: makeFigmaFromStore(store, pageId),
      def: {
        ...createShape,
        execute: (figma, args) => {
          createShape.execute(figma, args)
          return { error: 'failed after the first shape' }
        }
      },
      args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 },
      source: 'MCP'
    })

    expect(result).toEqual({ error: 'failed after the first shape' })
    expect(store.graph.getChildren(pageId)).toEqual([])
    expect(store.undo.canUndo).toBe(false)
  })
})

describe('a document replaced while a call waits', () => {
  test('a script queued across a reload is refused rather than editing the old document', async () => {
    const tab = createTab()
    const { store } = tab
    const release = await acquireDocumentEdit(store)
    const script = request('eval', {
      document_id: tab.id,
      code: "figma.currentPage.name = 'Edited'"
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    store.replaceGraph(new SceneGraph())
    release()

    await expect(script).rejects.toThrow('The document was replaced before the script ran')
    expect(store.undo.canUndo).toBe(false)
  })
})

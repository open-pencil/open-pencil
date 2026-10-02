import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { BUILTIN_IO_FORMATS, IORegistry, initCanvasKit, parseFigFile } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { handleExport } from '@/app/automation/bridge/export-handlers'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

const RED = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

let stores: EditorStore[] = []

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window.
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
})

afterEach(() => {
  for (const store of stores) store.dispose()
  stores = []
  Reflect.deleteProperty(globalThis, 'window')
})

async function storeWithCanvas(graph?: SceneGraph): Promise<EditorStore> {
  const store = createEditorStore(graph)
  stores.push(store)
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  store.setCanvasKit(ck, new SkiaRenderer(ck, surface))
  return store
}

function target(store: EditorStore, pageId: string): AutomationTarget {
  const page = store.graph.getNode(pageId)
  return {
    store,
    documentId: 'tab-1',
    documentName: 'Document',
    pageId,
    pageName: page?.name ?? ''
  }
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function resultBytes(response: unknown): Uint8Array {
  const result = (response as { result?: { base64?: string } }).result
  if (!result?.base64) throw new Error(`No image in ${JSON.stringify(response)}`)
  return toUint8Array(result.base64)
}

describe('automation export of a page that is not on screen', () => {
  test('export_image renders nodes by ID from another page', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const other = store.graph.addPage('Other').id
    const frame = store.graph.createNode('FRAME', other, { width: 40, height: 30, fills: [RED] })
    const handleTool = createAutomationToolHandler(makeFigmaFromStore)

    const response = await handleTool(target(store, shown), {
      name: 'export_image',
      args: { ids: [frame.id] }
    })

    expect(pngSize(resultBytes(response))).toEqual({ width: 40, height: 30 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('export_image renders the layers of the page named by page_id', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const other = store.graph.addPage('Other').id
    store.graph.createNode('FRAME', other, { width: 50, height: 20, fills: [RED] })
    const handleTool = createAutomationToolHandler(makeFigmaFromStore)

    const response = await handleTool(target(store, other), { name: 'export_image', args: {} })

    expect(pngSize(resultBytes(response))).toEqual({ width: 50, height: 20 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a page export renders the target page, not the selection on screen', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const selected = store.graph.createNode('FRAME', shown, { width: 10, height: 10, fills: [RED] })
    store.select([selected.id])
    const other = store.graph.addPage('Other').id
    store.graph.createNode('FRAME', other, { width: 60, height: 25, fills: [RED] })

    const response = await handleExport(target(store, other), { scope: 'page', format: 'png' })

    expect(pngSize(resultBytes(response))).toEqual({ width: 60, height: 25 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a page export loads the layers of a .fig page that has not been shown', async () => {
    const source = new SceneGraph()
    source.createNode('FRAME', source.getPages()[0].id, { width: 10, height: 10, fills: [RED] })
    const second = source.addPage('Second')
    source.createNode('FRAME', second.id, { width: 70, height: 35, fills: [RED] })
    const written = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', source)
    const bytes = written.data as Uint8Array
    const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
    const store = await storeWithCanvas(graph)
    const shown = store.state.currentPageId
    const pending = graph.getPages().find((page) => page.name === 'Second')
    if (!pending) throw new Error('Missing second page')
    expect(graph.getChildren(pending.id)).toHaveLength(0)

    const response = await handleExport(target(store, pending.id), { scope: 'page' })

    expect(pngSize(resultBytes(response))).toEqual({ width: 70, height: 35 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a page export lays out the target page first', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const other = store.graph.addPage('Other').id
    // Not laid out yet: the row hugs one 80 px child but still says 10 px, and clips.
    const row = store.graph.createNode('FRAME', other, {
      width: 10,
      height: 20,
      fills: [RED],
      clipsContent: true,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    store.graph.createNode('FRAME', row.id, { width: 80, height: 20, fills: [RED] })

    const response = await handleExport(target(store, other), { scope: 'page' })

    expect(pngSize(resultBytes(response))).toEqual({ width: 80, height: 20 })
    expect(store.state.currentPageId).toBe(shown)
  })
})

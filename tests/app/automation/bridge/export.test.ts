import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { imageSize } from '@open-pencil/scene-graph/images'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

const RED = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const { handleTargetCommand } = createAutomationCommandHandlers(makeFigmaFromStore)

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

/** A document on screen; its canvas has loaded its fonts unless `fonts` is false. */
async function storeWithCanvas(
  graph?: SceneGraph,
  { fonts = true }: { fonts?: boolean } = {}
): Promise<EditorStore> {
  const store = createEditorStore(graph)
  stores.push(store)
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  if (fonts) await renderer.loadFonts()
  store.setCanvasKit(ck, renderer)
  return store
}

/** A `.fig` opened like the app does: only the first page has its layers. */
async function storeWithUnshownPage(): Promise<{ store: EditorStore; pageId: string }> {
  const source = new SceneGraph()
  source.createNode('FRAME', source.getPages()[0].id, { width: 10, height: 10, fills: [RED] })
  const second = source.addPage('Second')
  source.createNode('FRAME', second.id, {
    name: 'Second frame',
    width: 70,
    height: 35,
    fills: [RED]
  })
  const written = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', source)
  const bytes = written.data as Uint8Array
  const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
  const store = await storeWithCanvas(graph)
  const page = graph.getPages().find((candidate) => candidate.name === 'Second')
  if (!page) throw new Error('Missing second page')
  expect(graph.getChildren(page.id)).toHaveLength(0)
  return { store, pageId: page.id }
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

    const response = await handleTargetCommand(target(store, shown), 'tool', {
      name: 'export_image',
      args: { ids: [frame.id] }
    })

    expect(imageSize(resultBytes(response))).toEqual({ width: 40, height: 30 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('export_image renders the layers of the page named by page_id', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const other = store.graph.addPage('Other').id
    store.graph.createNode('FRAME', other, { width: 50, height: 20, fills: [RED] })

    const response = await handleTargetCommand(target(store, other), 'tool', {
      name: 'export_image',
      args: {}
    })

    expect(imageSize(resultBytes(response))).toEqual({ width: 50, height: 20 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a page export renders the target page, not the selection on screen', async () => {
    const store = await storeWithCanvas()
    const shown = store.state.currentPageId
    const selected = store.graph.createNode('FRAME', shown, { width: 10, height: 10, fills: [RED] })
    store.select([selected.id])
    const other = store.graph.addPage('Other').id
    store.graph.createNode('FRAME', other, { width: 60, height: 25, fills: [RED] })

    const response = await handleTargetCommand(target(store, other), 'export', {
      scope: 'page',
      format: 'png'
    })

    expect(imageSize(resultBytes(response))).toEqual({ width: 60, height: 25 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a page export loads the layers of a .fig page that has not been shown', async () => {
    const { store, pageId } = await storeWithUnshownPage()
    const shown = store.state.currentPageId

    const response = await handleTargetCommand(target(store, pageId), 'export', { scope: 'page' })

    expect(imageSize(resultBytes(response))).toEqual({ width: 70, height: 35 })
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a JSX export lists the layers of a .fig page that has not been shown', async () => {
    const { store, pageId } = await storeWithUnshownPage()

    const response = (await handleTargetCommand(target(store, pageId), 'export_jsx', {})) as {
      result: { jsx: string }
    }

    expect(response.result.jsx).toContain('Second frame')
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

    const response = await handleTargetCommand(target(store, other), 'export', { scope: 'page' })

    expect(imageSize(resultBytes(response))).toEqual({ width: 80, height: 20 })
    expect(store.state.currentPageId).toBe(shown)
  })
})

// A document in a background tab has no canvas, and so no canvas renderer (#1169).
describe('automation export of a document whose canvas is not on screen', () => {
  function storeWithoutCanvas(): EditorStore {
    const store = createEditorStore()
    stores.push(store)
    expect(store.renderer).toBeNull()
    return store
  }

  test('export_image renders nodes by ID', async () => {
    const store = storeWithoutCanvas()
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, { width: 40, height: 30, fills: [RED] })

    const response = await handleTargetCommand(target(store, pageId), 'tool', {
      name: 'export_image',
      args: { ids: [frame.id], scale: 2 }
    })

    expect(imageSize(resultBytes(response))).toEqual({ width: 80, height: 60 })
  })

  test('a page export renders the layers of the page', async () => {
    const store = storeWithoutCanvas()
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, { width: 50, height: 20, fills: [RED] })

    const response = await handleTargetCommand(target(store, pageId), 'export', { scope: 'page' })

    expect(imageSize(resultBytes(response))).toEqual({ width: 50, height: 20 })
  })
})

// A tab brought to the front mounts a canvas that loads its fonts first (#1169).
describe('automation export of a document whose canvas just came on screen', () => {
  /** Starts the export without waiting for it. */
  function exportText(store: EditorStore, text: string): Promise<Uint8Array> {
    const pageId = store.state.currentPageId
    const node = store.graph.createNode('TEXT', pageId, { width: 120, height: 30, text })
    const answer = handleTargetCommand(target(store, pageId), 'tool', {
      name: 'export_image',
      args: { ids: [node.id] }
    })
    return answer.then(resultBytes)
  }

  async function exportWithFonts(text: string): Promise<Uint8Array> {
    return await exportText(await storeWithCanvas(), text)
  }

  test('export_image draws text once the canvas has its fonts', async () => {
    const store = await storeWithCanvas(undefined, { fonts: false })
    const renderer = store.renderer
    if (!renderer) throw new Error('Missing canvas renderer')

    const exported = exportText(store, 'Icons')
    await renderer.loadFonts()

    expect(await exported).toEqual(await exportWithFonts('Icons'))
  })

  test('export_image draws text without a canvas that went away before its fonts', async () => {
    const store = await storeWithCanvas(undefined, { fonts: false })

    const renderer = store.renderer
    if (!renderer) throw new Error('Missing canvas renderer')
    const fontsLoaded = renderer.whenFontsLoaded.bind(renderer)
    let waiting = () => {}
    const exportWaits = new Promise<void>((resolve) => (waiting = resolve))
    spyOn(renderer, 'whenFontsLoaded').mockImplementation(() => {
      waiting()
      return fontsLoaded()
    })

    const exported = exportText(store, 'Icons')
    await exportWaits
    // Unmounted as the canvas does it.
    store.removeCanvasRenderer(renderer)
    renderer.destroy()

    expect(await exported).toEqual(await exportWithFonts('Icons'))
  })
})

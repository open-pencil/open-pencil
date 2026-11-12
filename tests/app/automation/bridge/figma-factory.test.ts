import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'
import { createTab } from '@/app/tabs'

const { handleTargetCommand } = createAutomationCommandHandlers(makeFigmaFromStore)

let store: EditorStore | undefined

beforeEach(() => {
  // Edited layers flash, and nothing draws frames here.
  Object.assign(globalThis, {
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined
  })
})

afterEach(() => {
  store?.dispose()
  store = undefined
  vi.restoreAllMocks()
  for (const key of ['requestAnimationFrame', 'cancelAnimationFrame'])
    Reflect.deleteProperty(globalThis, key)
})

async function canvasRenderer(): Promise<SkiaRenderer> {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  return new SkiaRenderer(ck, surface)
}

async function storeWithCanvas(): Promise<EditorStore> {
  const created = createEditorStore()
  store = created
  const renderer = await canvasRenderer()
  created.setCanvasKit(renderer.ck, renderer)
  return created
}

function target(editor: EditorStore): AutomationTarget {
  return {
    store: editor,
    documentId: 'tab-1',
    documentName: 'Document',
    pageId: editor.state.currentPageId,
    pageName: 'Page 1'
  }
}

describe('automation Figma API', () => {
  test('agent calls measure with the canvas renderer and leave no graph listeners', async () => {
    const editor = await storeWithCanvas()
    // The graph's own edit recorders start with its first API.
    expect(makeFigmaFromStore(editor).renderer).toBe(editor.renderer)
    // Each edit listens while it records; what an API leaves behind stays after the calls.
    let listening = 0
    const subscribe = editor.graph.onNodeEvents.bind(editor.graph)
    vi.spyOn(editor.graph, 'onNodeEvents').mockImplementation((handlers) => {
      const unsubscribe = subscribe(handlers)
      listening++
      return () => {
        listening--
        unsubscribe()
      }
    })

    for (let call = 0; call < 3; call++) {
      await handleTargetCommand(target(editor), 'tool', {
        name: 'create_shape',
        args: { type: 'RECTANGLE', x: call * 50, y: 0, width: 40, height: 20 }
      })
      await handleTargetCommand(target(editor), 'eval', {
        code: 'figma.createEllipse().resize(10, 10)'
      })
    }

    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(6)
    expect(listening).toBe(0)
  })

  test('a script measures with the renderer the canvas has when it reads', async () => {
    const editor = await storeWithCanvas()
    const figma = makeFigmaFromStore(editor)
    const first = editor.renderer
    const next = await canvasRenderer()

    editor.setCanvasKit(next.ck, next)
    if (first) editor.removeCanvasRenderer(first)

    expect(figma.renderer).toBe(next)
  })
})

function shownDocument() {
  const tab = createTab()
  tab.store.setViewportSize(1000, 600)
  return tab
}

function viewOf(tab: ReturnType<typeof createTab>) {
  const { panX, panY, zoom } = tab.store.state
  return { panX, panY, zoom }
}

// Agents' `zoom_to_fit`, `set_viewport`, and `figma.viewport` moved a view of the API's own, so
// the canvas never moved (#1390).
describe('figma.viewport in the app', () => {
  test('scrollAndZoomIntoView fits the layers on the canvas', () => {
    const tab = shownDocument()
    const pageId = tab.store.state.currentPageId
    const frame = tab.store.graph.createNode('FRAME', pageId, {
      x: 3000,
      y: 2000,
      width: 4000,
      height: 2400
    })
    const figma = makeFigmaFromStore(tab.store)

    figma.viewport.scrollAndZoomIntoView([{ absoluteBoundingBox: frame }])

    const { panX, panY, zoom } = tab.store.state
    expect(frame.x * zoom + panX).toBeGreaterThanOrEqual(0)
    expect((frame.x + frame.width) * zoom + panX).toBeLessThanOrEqual(1000)
    expect(frame.y * zoom + panY).toBeGreaterThanOrEqual(0)
    expect((frame.y + frame.height) * zoom + panY).toBeLessThanOrEqual(600)
    expect(figma.viewport.zoom).toBe(zoom)
  })

  test('setting it centres the canvas on the point at the zoom', () => {
    const tab = shownDocument()
    const figma = makeFigmaFromStore(tab.store)

    figma.viewport.zoom = 0.5
    figma.viewport.center = { x: 200, y: 100 }

    expect(tab.store.state.zoom).toBe(0.5)
    expect(figma.viewport.center).toEqual({ x: 200, y: 100 })
    expect(figma.viewport.bounds).toEqual({ x: -800, y: -500, width: 2000, height: 1200 })
  })

  test('scrollAndZoomIntoView zooms in on small layers no further than 100%, as Figma does', () => {
    const tab = shownDocument()
    const frame = tab.store.graph.createNode('FRAME', tab.store.state.currentPageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 120
    })
    const figma = makeFigmaFromStore(tab.store)
    figma.viewport.zoom = 0.3

    figma.viewport.scrollAndZoomIntoView([{ absoluteBoundingBox: frame }])

    expect(tab.store.state.zoom).toBe(1)
  })

  test('a page that is not on screen keeps its view', () => {
    const tab = shownDocument()
    const other = tab.store.graph.addPage('Other').id
    const before = viewOf(tab)
    const figma = makeFigmaFromStore(tab.store, other)

    expect(() => {
      figma.viewport.zoom = 2
    }).toThrow()
    expect(viewOf(tab)).toEqual(before)
  })

  test('a document in a background tab keeps its view', () => {
    const background = shownDocument()
    shownDocument()
    const before = viewOf(background)
    const figma = makeFigmaFromStore(background.store)

    expect(() => {
      figma.viewport.zoom = 2
    }).toThrow()
    expect(viewOf(background)).toEqual(before)
  })
})

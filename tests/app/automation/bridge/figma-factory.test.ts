import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createTab } from '@/app/tabs'

beforeEach(() => {
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
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

    figma.viewport = { center: { x: 200, y: 100 }, zoom: 0.5 }

    expect(tab.store.state.zoom).toBe(0.5)
    expect(figma.viewport.center).toEqual({ x: 200, y: 100 })
  })

  test('a page that is not on screen keeps its view', () => {
    const tab = shownDocument()
    const other = tab.store.graph.addPage('Other').id
    const before = viewOf(tab)
    const figma = makeFigmaFromStore(tab.store, other)

    expect(() => {
      figma.viewport = { center: { x: 0, y: 0 }, zoom: 2 }
    }).toThrow()
    expect(viewOf(tab)).toEqual(before)
  })

  test('a document in a background tab keeps its view', () => {
    const background = shownDocument()
    shownDocument()
    const before = viewOf(background)
    const figma = makeFigmaFromStore(background.store)

    expect(() => {
      figma.viewport = { center: { x: 0, y: 0 }, zoom: 2 }
    }).toThrow()
    expect(viewOf(background)).toEqual(before)
  })
})

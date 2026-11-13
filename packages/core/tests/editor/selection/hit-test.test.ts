import { describe, expect, test } from 'bun:test'

import type { Font } from '@open-pencil/canvaskit'
import { createEditor } from '@open-pencil/core'
import type { RotationPreview } from '@open-pencil/core/geometry'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  hitTestComponentLabel,
  hitTestFrameTitle,
  hitTestSectionTitle
} from '#core/canvas/labels/hit-test'

/** Glyphs of a fixed width, enough for a name's hit box without loading a font. */
const labelFont = {
  getGlyphIDs(text: string) {
    return Uint16Array.from([...text].map((_, index) => index))
  },
  getGlyphWidths(ids: Uint16Array) {
    return new Float32Array(ids.length).fill(8)
  }
} as Font

/**
 * The canvas the editor hit-tests names through: the real label hit tests, at the editor's zoom.
 * A stand-in CanvasKit is enough, because a right-click reads names from the renderer.
 */
function installLabelHits(editor: ReturnType<typeof createEditor>) {
  const pageId = editor.state.currentPageId
  const hit = (
    testAt: typeof hitTestFrameTitle,
    graph: SceneGraph,
    x: number,
    y: number,
    preview?: RotationPreview | null
  ) => testAt(graph, x, y, editor.state.zoom, pageId, labelFont, undefined, { preview })
  editor.setCanvasKit(
    {} as Parameters<typeof editor.setCanvasKit>[0],
    {
      hitTestFrameTitle: (graph, x, y, preview) => hit(hitTestFrameTitle, graph, x, y, preview),
      hitTestSectionTitle: (graph, x, y, preview) => hit(hitTestSectionTitle, graph, x, y, preview),
      hitTestComponentLabel: (graph, x, y, preview) =>
        hit(hitTestComponentLabel, graph, x, y, preview)
    } as Parameters<typeof editor.setCanvasKit>[1]
  )
}

/**
 * One pane's canvas. A name is hit with that pane's page and zoom, which the renderer stores
 * apart from the editor's current view.
 */
function paneLabelRenderer(pageId: string, zoom: number) {
  const hit = (
    testAt: typeof hitTestFrameTitle,
    graph: SceneGraph,
    x: number,
    y: number,
    preview?: RotationPreview | null
  ) => testAt(graph, x, y, zoom, pageId, labelFont, undefined, { preview })
  return {
    hitTestFrameTitle: (graph, x, y, preview) => hit(hitTestFrameTitle, graph, x, y, preview),
    hitTestSectionTitle: (graph, x, y, preview) => hit(hitTestSectionTitle, graph, x, y, preview),
    hitTestComponentLabel: (graph, x, y, preview) =>
      hit(hitTestComponentLabel, graph, x, y, preview)
  } as Parameters<ReturnType<typeof createEditor>['setCanvasKit']>[1]
}

describe('editor hit testing', () => {
  test('finds layers from the page whatever container is entered', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    editor.state.enteredContainerId = frame.id
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    expect(editor.hitTestAtPoint(130, 130)?.id).toBe(child.id)
  })

  test('selectAtPoint on a board selects the frame over its child', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    editor.selectAtPoint(130, 130)
    expect([...editor.state.selectedIds]).toEqual([frame.id])
  })

  test('selectAtPoint inside an entered board frame selects its child', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    editor.state.enteredContainerId = frame.id
    editor.selectAtPoint(130, 130)
    expect([...editor.state.selectedIds]).toEqual([child.id])
    // The entered container follows the selection, as after a press.
    expect(editor.state.enteredContainerId).toBe(frame.id)
    editor.selectAtPoint(500, 500)
    expect([...editor.state.selectedIds]).toEqual([])
  })

  // Live in Figma: a press passes through a locked layer to the one under it, and a right-click
  // selects the locked layer, whose menu offers Unlock.
  test('a press passes through a locked layer and a right-click selects it', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const fill = [
      { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
    ]
    const under = editor.graph.createNode('RECTANGLE', pageId, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: fill
    })
    const locked = editor.graph.createNode('RECTANGLE', pageId, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fills: fill,
      locked: true
    })
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    expect(editor.hitTestAtPoint(100, 100)?.id).toBe(under.id)
    editor.selectAtPoint(100, 100)
    expect([...editor.state.selectedIds]).toEqual([locked.id])
  })

  // A name sits above its layer, outside the body a graph hit test sees. A click selects the
  // layer; a right-click has to as well, or the context menu opens with nothing selected.
  test('selectAtPoint on a frame, section, or component name selects that layer', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame',
      x: 100,
      y: 100,
      width: 200,
      height: 120
    })
    const section = editor.graph.createNode('SECTION', pageId, {
      name: 'Section',
      x: 400,
      y: 100,
      width: 200,
      height: 160
    })
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Button',
      x: 100,
      y: 360,
      width: 120,
      height: 40
    })
    installLabelHits(editor)

    editor.select([frame.id])
    editor.selectAtPoint(108, 86)
    expect([...editor.state.selectedIds]).toEqual([frame.id])

    editor.clearSelection()
    editor.selectAtPoint(108, 86)
    expect([...editor.state.selectedIds]).toEqual([frame.id])

    editor.selectAtPoint(410, 80)
    expect([...editor.state.selectedIds]).toEqual([section.id])

    editor.selectAtPoint(108, 348)
    expect([...editor.state.selectedIds]).toEqual([component.id])

    editor.selectAtPoint(800, 800)
    expect([...editor.state.selectedIds]).toEqual([])
  })

  // Two panes can show different pages, at different zooms, with a frame name at the same canvas
  // point. A right-click selects the name drawn on the pane that was clicked.
  test('selectAtPoint on a frame name uses the pane that was clicked', () => {
    const editor = createEditor()
    const pageA = editor.state.currentPageId
    const pageB = editor.graph.addPage('Other').id
    const frameA = editor.graph.createNode('FRAME', pageA, {
      name: 'Frame',
      x: 100,
      y: 100,
      width: 200,
      height: 120
    })
    const frameB = editor.graph.createNode('FRAME', pageB, {
      name: 'Frame',
      x: 100,
      y: 100,
      width: 200,
      height: 120
    })
    const paneA = paneLabelRenderer(pageA, 1)
    const paneB = paneLabelRenderer(pageB, 2)
    const canvasKit = {} as Parameters<typeof editor.setCanvasKit>[0]
    editor.setCanvasKit(canvasKit, paneA)
    editor.setCanvasKit(canvasKit, paneB)

    editor.state.currentPageId = pageB
    editor.state.zoom = 2
    editor.selectAtPoint(108, 91, paneB)
    expect([...editor.state.selectedIds]).toEqual([frameB.id])

    editor.state.currentPageId = pageA
    editor.state.zoom = 1
    editor.selectAtPoint(108, 91, paneA)
    expect([...editor.state.selectedIds]).toEqual([frameA.id])
  })

  test('selectAtPoint on a frame name keeps a selection that already includes it', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Frame',
      x: 100,
      y: 100,
      width: 200,
      height: 120
    })
    const other = editor.graph.createNode('RECTANGLE', pageId, {
      x: 400,
      y: 100,
      width: 80,
      height: 40
    })
    installLabelHits(editor)
    editor.select([other.id, frame.id])

    editor.selectAtPoint(108, 86)
    expect([...editor.state.selectedIds]).toEqual([other.id, frame.id])
  })
})

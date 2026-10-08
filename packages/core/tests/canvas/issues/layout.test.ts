import { describe, expect, test } from 'bun:test'

import {
  hitTestIssueMarkers,
  layoutIssueMarkers,
  type DesignIssueMarker,
  type IssueMarkerLayoutOptions
} from '@open-pencil/core/canvas'
import { SceneGraph } from '@open-pencil/scene-graph'

/** Every label is one 6px glyph wide, so marker widths stay independent of fonts. */
const measureText = (text: string) => text.length * 6

function setup() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const options: IssueMarkerLayoutOptions = {
    pageId,
    view: { panX: 0, panY: 0, zoom: 1, width: 800, height: 600, insetTop: 0, insetLeft: 0 },
    measureText
  }
  return { graph, pageId, options }
}

function warning(nodeId: string, count = 1): DesignIssueMarker {
  return { nodeId, severity: 'warning', count }
}

describe('issue marker layout', () => {
  test('attaches a marker just outside the top-right corner of its layer', () => {
    const { graph, pageId, options } = setup()
    const card = graph.createNode('FRAME', pageId, { x: 100, y: 200, width: 120, height: 80 })

    const [marker] = layoutIssueMarkers(graph, [warning(card.id)], options)

    expect(marker?.anchor).toEqual({ x: 220, y: 200 })
    expect(marker?.rect).toEqual({ x: 224, y: 180, width: 16, height: 16 })
  })

  test('skips hidden layers, layers inside hidden parents, and other pages', () => {
    const { graph, pageId, options } = setup()
    const hidden = graph.createNode('FRAME', pageId, { width: 100, height: 100, visible: false })
    const child = graph.createNode('RECTANGLE', hidden.id, { width: 40, height: 40 })
    const otherPage = graph.addPage('Other')
    const elsewhere = graph.createNode('FRAME', otherPage.id, { width: 100, height: 100 })

    const markers = [warning(hidden.id), warning(child.id), warning(elsewhere.id)]

    expect(layoutIssueMarkers(graph, markers, options)).toEqual([])
  })

  test('skips layers clipped away by a frame and anchors partly clipped ones to what shows', () => {
    const { graph, pageId, options } = setup()
    const frame = graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      clipsContent: true
    })
    const outside = graph.createNode('RECTANGLE', frame.id, { x: 300, y: 0, width: 50, height: 50 })
    const overflowing = graph.createNode('RECTANGLE', frame.id, {
      x: 150,
      y: 100,
      width: 100,
      height: 50
    })

    const placed = layoutIssueMarkers(
      graph,
      [warning(outside.id), warning(overflowing.id)],
      options
    )

    expect(placed.map((marker) => marker.nodeIds)).toEqual([[overflowing.id]])
    expect(placed[0]?.anchor).toEqual({ x: 300, y: 200 })
  })

  test('hands the marker of a layer too small to see to its nearest large enough ancestor', () => {
    const { graph, pageId, options } = setup()
    const card = graph.createNode('FRAME', pageId, { x: 0, y: 100, width: 400, height: 300 })
    const dot = graph.createNode('ELLIPSE', card.id, { x: 20, y: 20, width: 40, height: 40 })

    const zoomedOut = { ...options, view: { ...options.view, zoom: 0.25 } }
    const [marker] = layoutIssueMarkers(graph, [warning(dot.id)], zoomedOut)

    expect(marker?.nodeIds).toEqual([dot.id])
    expect(marker?.anchor).toEqual({ x: 100, y: 25 })
  })

  test('merges overlapping markers behind the most severe one', () => {
    const { graph, pageId, options } = setup()
    const parent = graph.createNode('FRAME', pageId, { x: 100, y: 100, width: 200, height: 200 })
    const child = graph.createNode('FRAME', parent.id, { x: 100, y: 0, width: 100, height: 50 })
    const far = graph.createNode('FRAME', pageId, { x: 500, y: 400, width: 50, height: 50 })

    const placed = layoutIssueMarkers(
      graph,
      [warning(parent.id, 2), { nodeId: child.id, severity: 'error', count: 1 }, warning(far.id)],
      options
    )

    expect(placed).toHaveLength(2)
    expect(placed[0]).toMatchObject({
      key: child.id,
      nodeIds: [child.id, parent.id],
      severity: 'error',
      count: 3
    })
    expect(placed[1]?.nodeIds).toEqual([far.id])
  })

  test('keeps markers inside the viewport and below the rulers', () => {
    const { graph, pageId, options } = setup()
    const wide = graph.createNode('FRAME', pageId, { x: 10, y: 10, width: 1000, height: 100 })

    const withRulers = { ...options, view: { ...options.view, insetTop: 20, insetLeft: 20 } }
    const [marker] = layoutIssueMarkers(graph, [warning(wide.id)], withRulers)

    expect(marker?.rect).toEqual({ x: 780, y: 24, width: 16, height: 16 })
  })

  test('leaves out layers under an active edit and widens markers for large counts', () => {
    const { graph, pageId, options } = setup()
    const editing = graph.createNode('TEXT', pageId, { x: 0, y: 100, width: 100, height: 20 })
    const busy = graph.createNode('FRAME', pageId, { x: 300, y: 300, width: 100, height: 100 })

    const placed = layoutIssueMarkers(graph, [warning(editing.id), warning(busy.id, 120)], {
      ...options,
      suppressedIds: new Set([editing.id])
    })

    expect(placed.map((marker) => marker.key)).toEqual([busy.id])
    expect(placed[0]?.rect.width).toBe(28)
  })
})

describe('issue edge pins', () => {
  test('pins an issue outside the viewport to the edge in its direction', () => {
    const { graph, pageId, options } = setup()
    const left = graph.createNode('FRAME', pageId, { x: -500, y: 250, width: 100, height: 100 })

    const [pin] = layoutIssueMarkers(graph, [warning(left.id)], options)

    expect(pin).toMatchObject({
      key: `edge:${left.id}`,
      direction: { x: -1, y: 0 },
      rect: { x: 12, y: 292, width: 16, height: 16 }
    })
  })

  test('places an issue off a corner in that corner', () => {
    const { graph, pageId, options } = setup()
    const far = graph.createNode('FRAME', pageId, { x: 4380, y: -2720, width: 40, height: 40 })

    const [pin] = layoutIssueMarkers(graph, [warning(far.id)], options)

    expect(pin?.rect).toEqual({ x: 772, y: 12, width: 16, height: 16 })
    expect(pin?.direction?.x).toBeGreaterThan(0)
    expect(pin?.direction?.y).toBeLessThan(0)
  })

  test('merges pins in one direction and leads with the most severe, then nearest, layer', () => {
    const { graph, pageId, options } = setup()
    const near = graph.createNode('FRAME', pageId, { x: 900, y: 280, width: 40, height: 40 })
    const far = graph.createNode('FRAME', pageId, { x: 2000, y: 300, width: 40, height: 40 })

    const [pin, ...rest] = layoutIssueMarkers(
      graph,
      [warning(near.id), { nodeId: far.id, severity: 'error', count: 1 }],
      options
    )

    expect(rest).toEqual([])
    // The error is farther than the warning, but the pin shows an error, so it leads there.
    expect(pin).toMatchObject({ severity: 'error', count: 2, nodeIds: [far.id, near.id] })
  })

  test('slides a pin along its edge out from under floating UI', () => {
    const { graph, pageId, options } = setup()
    const below = graph.createNode('FRAME', pageId, { x: 380, y: 1200, width: 40, height: 40 })
    const toolbar = { x: 350, y: 560, width: 100, height: 40 }

    const [pin] = layoutIssueMarkers(graph, [warning(below.id)], {
      ...options,
      obstacles: [toolbar]
    })

    expect(pin?.rect).toEqual({ x: 332, y: 572, width: 16, height: 16 })
  })
})

describe('issue marker hit testing', () => {
  test('returns the topmost marker under the point', () => {
    const { graph, pageId, options } = setup()
    const card = graph.createNode('FRAME', pageId, { x: 100, y: 200, width: 120, height: 80 })
    const placed = layoutIssueMarkers(graph, [warning(card.id)], options)

    expect(hitTestIssueMarkers(placed, 232, 188)?.key).toBe(card.id)
    expect(hitTestIssueMarkers(placed, 200, 188)).toBeNull()
  })
})

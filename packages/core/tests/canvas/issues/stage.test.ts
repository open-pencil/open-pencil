import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { placeIssueMarkers } from '#core/canvas/issues/layout'
import { IssueMarkerStage } from '#core/canvas/issues/stage'
import type { DesignIssueMarker } from '#core/canvas/issues/types'

const measureText = (text: string) => text.length * 6

function setup() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const card = graph.createNode('FRAME', pageId, { x: 100, y: 100, width: 200, height: 80 })
  const markers: DesignIssueMarker[] = [{ nodeId: card.id, severity: 'warning', count: 1 }]
  const stage = new IssueMarkerStage()
  const view = (panX: number, zoom = 1) => ({
    panX,
    panY: 0,
    zoom,
    width: 800,
    height: 600,
    insetTop: 0,
    insetLeft: 0
  })
  return { graph, pageId, card, markers, stage, view }
}

describe('issue marker stage', () => {
  test('keeps the stage across pans and zooms and places it in each viewport', () => {
    const { graph, pageId, markers, stage, view } = setup()
    const first = stage.update(graph, markers, { pageId }, 1, 0)
    expect(stage.update(graph, markers, { pageId }, 1, 0)).toBe(first)

    const [near] = placeIssueMarkers(first, { view: view(0), measureText })
    const [panned] = placeIssueMarkers(first, { view: view(50), measureText })
    const [zoomed] = placeIssueMarkers(first, { view: view(0, 2), measureText })
    expect(panned.anchor).toEqual({ x: near.anchor.x + 50, y: near.anchor.y })
    expect(zoomed.anchor).toEqual({ x: 600, y: 200 })
  })

  test('restages when the canvas, the markers, or the suppressed layers change', () => {
    const { graph, pageId, card, markers, stage, view } = setup()
    const first = stage.update(graph, markers, { pageId }, 1, 0)

    graph.updateNode(card.id, { x: 300 })
    expect(stage.update(graph, markers, { pageId }, 1, 0)).toBe(first)
    const moved = stage.update(graph, markers, { pageId }, 2, 0)
    expect(moved).not.toBe(first)
    expect(placeIssueMarkers(moved, { view: view(0), measureText })[0].anchor.x).toBe(500)

    const suppressed = stage.update(graph, markers, { pageId, suppressedIds: new Set([card.id]) }, 2, 0)
    expect(suppressed).toEqual([])
    const replaced = stage.update(graph, [...markers], { pageId }, 2, 0)
    expect(replaced).not.toBe(moved)
    expect(replaced).toHaveLength(1)
  })
})

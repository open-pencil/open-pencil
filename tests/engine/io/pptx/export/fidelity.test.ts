import { describe, expect, test } from 'bun:test'

import { renderNodesToPPTX, type Effect, type PPTXExportStats } from '@open-pencil/core'
import { TransformMatrix } from '@open-pencil/scene-graph'

import { hasUnsupportedTransform, nodeBox } from '#core/io/formats/pptx/geometry'

import {
  TINY_PNG,
  inches,
  makeGraph,
  makeSlideFrame,
  pageId,
  placements,
  slideXML,
  solidFill,
  solidStroke,
  stubRasterize,
  unzipPPTX
} from './helpers'

function shadow(overrides: Partial<Effect> = {}): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 1 },
    offset: { x: 8, y: 8 },
    radius: 8,
    spread: 0,
    visible: true,
    ...overrides
  }
}

describe('PPTX fidelity fallbacks', () => {
  test('fits later frames with different dimensions into the deck layout', async () => {
    const graph = makeGraph()
    const first = makeSlideFrame(graph, 'Wide')
    const square = graph.createNode('FRAME', pageId(graph), {
      width: 1000,
      height: 1000,
      fills: [solidFill(1, 0, 0)]
    })

    const data = await renderNodesToPPTX(graph, pageId(graph), [first.id, square.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const [frame] = placements(slideXML(unzipPPTX(data), 2))
    expect(frame.width).toBeCloseTo(7.5, 2)
    expect(frame.height).toBeCloseTo(7.5, 2)
    expect(frame.centerX).toBeCloseTo(13.333 / 2, 2)
    expect(frame.centerY).toBeCloseTo(7.5 / 2, 2)
  })

  test('rasterizes asymmetric corners and multiple shadow effects', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const corners = graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      independentCorners: true,
      topLeftRadius: 20,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      fills: [solidFill(1, 0, 0)]
    })
    const shadows = graph.createNode('RECTANGLE', frame.id, {
      x: 200,
      width: 100,
      height: 100,
      fills: [solidFill(0, 0, 1)],
      effects: [shadow(), shadow({ offset: { x: -8, y: 8 } })]
    })
    const calls: string[][] = []
    let stats: PPTXExportStats | null = null

    await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        calls.push(ids)
        return Promise.resolve(TINY_PNG)
      },
      onStats: (value) => {
        stats = value
      }
    })

    expect(calls).toEqual([[corners.id], [shadows.id]])
    expect(stats?.fallbackReasons).toEqual({ 'asymmetric corners': 1, 'multiple shadows': 1 })
  })

  test('rotates solid shadow offsets with their shape', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    graph.createNode('RECTANGLE', frame.id, {
      x: 300,
      y: 200,
      width: 100,
      height: 50,
      rotation: 90,
      fills: [solidFill(1, 0, 0)],
      effects: [shadow({ offset: { x: 10, y: 0 }, radius: 0 })]
    })

    const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: stubRasterize
    })
    expect(data).not.toBeNull()
    if (!data) return
    const [shadowShape, shape] = placements(slideXML(unzipPPTX(data), 1))
    expect(shadowShape.centerX).toBeCloseTo(shape.centerX, 3)
    expect(shadowShape.centerY - shape.centerY).toBeCloseTo(inches(10), 3)
  })

  test('preserves scale and rejects skew in decomposed transforms', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 50,
      fills: [solidFill(1, 0, 0)]
    })
    const base = {
      graph,
      pxPerInch: 100,
      offsetX: 0,
      offsetY: 0,
      toSlideSpace: TransformMatrix.scaled(2, 3)
    }
    const box = nodeBox(base, node)
    expect(box.w).toBeCloseTo(2)
    expect(box.h).toBeCloseTo(1.5)
    expect(hasUnsupportedTransform(base, node)).toBeFalse()
    expect(
      hasUnsupportedTransform({ ...base, toSlideSpace: [1, 0.5, 0, 0, 1, 0, 0, 0, 1] }, node)
    ).toBeTrue()
  })

  test('rasterizes native styles that would otherwise be silently dropped', async () => {
    const graph = makeGraph()
    const frame = makeSlideFrame(graph, 'Slide')
    const multipleStrokes = graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      fills: [solidFill(1, 1, 1)],
      strokes: [solidStroke(1, 0, 0), solidStroke(0, 0, 1)]
    })
    const spreadShadow = graph.createNode('RECTANGLE', frame.id, {
      x: 200,
      width: 100,
      height: 100,
      fills: [solidFill(1, 1, 1)],
      effects: [shadow({ spread: 4 })]
    })
    const calls: string[][] = []

    await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
      rasterize: (ids) => {
        calls.push(ids)
        return Promise.resolve(TINY_PNG)
      }
    })

    expect(calls).toEqual([[multipleStrokes.id], [spreadShadow.id]])
  })
})

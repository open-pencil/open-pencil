import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorRoute,
  connectorSublayers,
  createConnector
} from '@open-pencil/scene-graph/connectors'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { arrangeLayers } from '#core/layout/arrange/layers'

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** A page with layers piled on each other, as an agent drawing blindly leaves them. */
function pile() {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const box = (name: string, parentId = pageId) =>
    graph.createNode('RECTANGLE', parentId, { name, x: 100, y: 100, width: 120, height: 50 })
  const join = (from: SceneNode, to: SceneNode, lineType?: 'STRAIGHT') =>
    createConnector(graph, pageId, {
      start: boundEndpoint(from.id),
      end: boundEndpoint(to.id),
      ...(lineType ? { lineType } : {})
    })
  return { graph, pageId, box, join }
}

const node = (graph: SceneGraph, id: string) => expectDefined(graph.getNode(id))

describe('arrangeLayers', () => {
  test('spreads piled layers into ranks along the flow and reroutes their connectors', async () => {
    const { graph, box, join } = pile()
    const [a, b, c] = [box('A'), box('B'), box('C')]
    const ab = join(a, b)
    const ac = join(a, c)

    const result = await arrangeLayers(graph, [a.id, b.id, c.id], { layout: 'flow' })

    expect(result).toEqual({ layers: 3, groups: 0, connectors: 2 })
    const [placedA, placedB, placedC] = [a, b, c].map((layer) => node(graph, layer.id))
    expect(overlap(placedB, placedC)).toBe(false)
    expect(placedA.y + placedA.height).toBeLessThan(Math.min(placedB.y, placedC.y))
    // The drawing keeps its top-left corner.
    expect(Math.min(placedA.x, placedB.x, placedC.x)).toBe(100)
    expect(Math.min(placedA.y, placedB.y, placedC.y)).toBe(100)
    for (const connector of [ab, ac]) {
      const routed = node(graph, connector.id)
      expect(routed.connectorStart).toMatchObject({ nodeId: a.id, magnet: 'BOTTOM' })
      expect(routed.connectorEnd?.magnet).toBe('TOP')
    }
  })

  test('lays a section out around its layers only when all of them were chosen', async () => {
    const { graph, pageId, box, join } = pile()
    const start = box('Start')
    const section = graph.createNode('SECTION', pageId, {
      name: 'Steps',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    const [one, two] = [box('One', section.id), box('Two', section.id)]
    join(start, one)
    join(one, two)

    expect(
      await arrangeLayers(graph, [start.id, section.id, one.id, two.id], {
        layout: 'flow',
        direction: 'LR'
      })
    ).toMatchObject({ layers: 3, groups: 1 })
    const placed = node(graph, section.id)
    for (const inner of [one, two]) {
      const child = node(graph, inner.id)
      expect(child.x).toBeGreaterThan(0)
      expect(child.x + child.width).toBeLessThan(placed.width)
      expect(child.y + child.height).toBeLessThan(placed.height)
    }

    // A section holding a layer that was not chosen moves as one box and keeps its size.
    const other = pile()
    const first = other.box('First')
    const held = other.graph.createNode('SECTION', other.pageId, {
      x: 400,
      y: 400,
      width: 300,
      height: 200
    })
    const inside = other.box('Inside', held.id)
    other.join(first, held)
    expect(await arrangeLayers(other.graph, [first.id, held.id], { layout: 'flow' })).toMatchObject(
      {
        layers: 2,
        groups: 0
      }
    )
    expect(node(other.graph, held.id)).toMatchObject({ width: 300, height: 200 })
    expect(node(other.graph, inside.id)).toMatchObject({ x: 100, y: 100 })
  })

  test('keeps where a connector attaches inside a box, and a straight line its ends', async () => {
    const { graph, pageId, box, join } = pile()
    const frame = graph.createNode('FRAME', pageId, { x: 0, y: 0, width: 300, height: 200 })
    const button = box('Button', frame.id)
    const target = box('Target')
    const inner = join(button, target)
    const straight = join(target, box('Next'), 'STRAIGHT')
    const before = node(graph, straight.id)

    const result = await arrangeLayers(
      graph,
      [frame.id, target.id, expectDefined(before.connectorEnd?.nodeId)],
      { layout: 'flow' }
    )

    expect(result.connectors).toBe(1)
    expect(node(graph, inner.id).connectorStart?.nodeId).toBe(button.id)
    expect(node(graph, straight.id).connectorStart).toEqual(before.connectorStart)
    expect(node(graph, straight.id).connectorEnd).toEqual(before.connectorEnd)
  })

  test('refuses layers with different parents outside chosen sections', async () => {
    const { graph, pageId, box } = pile()
    const frame = graph.createNode('FRAME', pageId, { width: 300, height: 200 })
    await expect(
      arrangeLayers(graph, [box('Page').id, box('Framed', frame.id).id], { layout: 'flow' })
    ).rejects.toThrow('must share a parent')
  })

  test('spread unpiles layers without connectors and keeps the pile’s corner', async () => {
    const { graph, box } = pile()
    const layers = ['A', 'B', 'C', 'D'].map((name) => box(name))

    await arrangeLayers(
      graph,
      layers.map((layer) => layer.id),
      { layout: 'spread' }
    )

    const placed = layers.map((layer) => node(graph, layer.id))
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) expect(overlap(a, b)).toBe(false)
    }
    expect(Math.min(...placed.map((layer) => layer.x))).toBe(100)
    expect(Math.min(...placed.map((layer) => layer.y))).toBe(100)
  })

  test('grid, row, and column place layers in order from the first, and connectors follow', async () => {
    const { graph, box, join } = pile()
    const [a, b, c] = [box('A'), box('B'), box('C')]
    const ab = join(a, b)

    await arrangeLayers(graph, [a.id, b.id, c.id], { layout: 'row', spacing: 10 })
    expect([a, b, c].map((layer) => node(graph, layer.id).x)).toEqual([100, 230, 360])
    // The connector between them was laid out again where they now are.
    const routed = node(graph, ab.id)
    expect(routed.x).toBeGreaterThanOrEqual(100 + 120)

    await arrangeLayers(graph, [a.id, b.id, c.id], { layout: 'grid', columns: 2, spacing: 10 })
    expect([a, b, c].map((layer) => [node(graph, layer.id).x, node(graph, layer.id).y])).toEqual([
      [100, 100],
      [230, 100],
      [100, 160]
    ])
  })

  test('bends a page connector between layers inside a frame where the layers are', async () => {
    const { graph, pageId, box, join } = pile()
    const frame = graph.createNode('FRAME', pageId, { x: 500, y: 300, width: 900, height: 600 })
    const [a, b, c] = [box('A', frame.id), box('B', frame.id), box('C', frame.id)]
    const connectors = [join(a, b), join(a, c)]

    await arrangeLayers(graph, [a.id, b.id, c.id], { layout: 'flow' })

    const world = (layer: SceneNode) => {
      const placed = node(graph, layer.id)
      return { ...placed, x: placed.x + 500, y: placed.y + 300 }
    }
    const top = world(a)
    for (const [connector, target] of [
      [connectors[0], b],
      [connectors[1], c]
    ] as const) {
      const route = expectDefined(connectorRoute(graph, node(graph, connector.id)))
      const bottom = world(target)
      // Every bend lies between the source's bottom and the target's top, in page axes.
      for (const piece of route.pieces.slice(1)) {
        expect(piece.from.y).toBeGreaterThan(top.y + top.height)
        expect(piece.from.y).toBeLessThan(bottom.y)
      }
    }
  })

  test('counts a layer given twice once', async () => {
    const { graph, box, join } = pile()
    const [a, b] = [box('A'), box('B')]
    join(a, b)
    expect(await arrangeLayers(graph, [a.id, a.id, b.id], { layout: 'flow' })).toMatchObject({
      layers: 2
    })
  })

  test('moves a chosen layer with a chosen section that is not laid out around it', async () => {
    const { graph, pageId, box, join } = pile()
    const start = box('Start')
    const section = graph.createNode('SECTION', pageId, { x: 600, y: 600, width: 400, height: 300 })
    const [one] = [box('One', section.id), box('Two', section.id)]
    join(start, section)

    expect(
      await arrangeLayers(graph, [start.id, section.id, one.id], { layout: 'flow' })
    ).toMatchObject({ layers: 2, groups: 0 })
    expect(node(graph, one.id)).toMatchObject({ x: 100, y: 100 })
  })

  test('places grid, row, and column layers only within one parent', async () => {
    const { graph, pageId, box } = pile()
    const frame = graph.createNode('FRAME', pageId, { x: 500, y: 0, width: 300, height: 200 })
    await expect(
      arrangeLayers(graph, [box('Page').id, box('Framed', frame.id).id], { layout: 'row' })
    ).rejects.toThrow('must share a parent')
  })

  test('spread starts a section from where it is, like the layers beside it', async () => {
    const { graph, pageId, box } = pile()
    const near = box('Near')
    const section = graph.createNode('SECTION', pageId, {
      x: 1500,
      y: 100,
      width: 300,
      height: 200
    })
    const inside = box('Inside', section.id)

    await arrangeLayers(graph, [near.id, section.id, inside.id], { layout: 'spread' })

    expect(node(graph, section.id).x - node(graph, near.id).x).toBeGreaterThan(1000)
  })

  test('moves nothing when a layer changes while the layout runs', async () => {
    const { graph, box, join } = pile()
    const [a, b] = [box('A'), box('B')]
    join(a, b)

    const arranging = arrangeLayers(graph, [a.id, b.id], { layout: 'flow' })
    // A user drags A before the layout comes back.
    graph.updateNode(a.id, { x: 700 })

    await expect(arranging).rejects.toThrow('changed while they were being arranged')
    expect(node(graph, a.id).x).toBe(700)
    expect(node(graph, b.id)).toMatchObject({ x: 100, y: 100 })
  })

  test('moves nothing when a connector or a section child is added while the layout runs', async () => {
    const joined = pile()
    const [a, b, c] = [joined.box('A'), joined.box('B'), joined.box('C')]
    joined.join(a, b)
    const arranging = arrangeLayers(joined.graph, [a.id, b.id, c.id], { layout: 'flow' })
    joined.join(b, c)
    await expect(arranging).rejects.toThrow('changed while they were being arranged')

    const held = pile()
    const section = held.graph.createNode('SECTION', held.pageId, {
      x: 0,
      y: 0,
      width: 300,
      height: 200
    })
    const inside = held.box('Inside', section.id)
    const outside = held.box('Outside')
    const layingOut = arrangeLayers(held.graph, [section.id, inside.id, outside.id], {
      layout: 'flow'
    })
    held.box('Added', section.id)
    await expect(layingOut).rejects.toThrow('changed while they were being arranged')
  })

  test('moves nothing when a connector is re-pinned or relabelled while the layout runs', async () => {
    const pinned = pile()
    const [a, b] = [pinned.box('A'), pinned.box('B')]
    const ab = pinned.join(a, b)
    const arranging = arrangeLayers(pinned.graph, [a.id, b.id], { layout: 'flow' })
    pinned.graph.updateNode(ab.id, { connectorEnd: boundEndpoint(b.id, 'LEFT') })
    await expect(arranging).rejects.toThrow('changed while they were being arranged')
    expect(node(pinned.graph, ab.id).connectorEnd?.magnet).toBe('LEFT')

    const labelled = pile()
    const [c, d] = [labelled.box('C'), labelled.box('D')]
    const cd = labelled.join(c, d)
    const label = expectDefined(connectorSublayers(labelled.graph, cd)).label
    const layingOut = arrangeLayers(labelled.graph, [c.id, d.id], { layout: 'flow' })
    labelled.graph.updateNode(label.id, { text: 'A much longer label', width: 160, height: 24 })
    await expect(layingOut).rejects.toThrow('changed while they were being arranged')
  })
})

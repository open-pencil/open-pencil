import { describe, expect, test } from 'bun:test'

import { getWorldMatrix, SceneGraph, TransformMatrix } from '@open-pencil/scene-graph'

function setup() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  return { graph, pageId }
}

function worldCorners(graph: SceneGraph, id: string) {
  const node = graph.getNode(id)
  if (!node) throw new Error(`missing node ${id}`)
  const w = node.width
  const h = node.height
  return TransformMatrix.mapPoints(getWorldMatrix(node, graph), [0, 0, w, 0, w, h, 0, h])
}

function expectSameCorners(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 6))
}

describe('reparentNode keeps the node where it is drawn', () => {
  test('moving into a rotated frame keeps the corners and counter-rotates the node', () => {
    const { graph, pageId } = setup()
    const frame = graph.createNode('FRAME', pageId, {
      x: 100,
      y: 50,
      width: 240,
      height: 240,
      rotation: 30
    })
    const rect = graph.createNode('RECTANGLE', pageId, { x: 500, y: 400, width: 40, height: 20 })
    const before = worldCorners(graph, rect.id)

    graph.reparentNode(rect.id, frame.id)

    expectSameCorners(worldCorners(graph, rect.id), before)
    expect(graph.getNode(rect.id)?.rotation).toBeCloseTo(-30, 6)
  })

  test('moving into a rotated frame and back out restores the original transform', () => {
    const { graph, pageId } = setup()
    const frame = graph.createNode('FRAME', pageId, {
      x: 100,
      y: 50,
      width: 240,
      height: 240,
      rotation: 30
    })
    const rect = graph.createNode('RECTANGLE', pageId, { x: 500, y: 400, width: 40, height: 20 })

    graph.reparentNode(rect.id, frame.id)
    graph.reparentNode(rect.id, pageId)

    const node = graph.getNode(rect.id)
    expect(node?.x).toBeCloseTo(500, 6)
    expect(node?.y).toBeCloseTo(400, 6)
    expect(node?.rotation).toBeCloseTo(0, 6)
  })

  test('moving into a flipped frame keeps the corners', () => {
    const { graph, pageId } = setup()
    const frame = graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      flipX: true
    })
    const rect = graph.createNode('RECTANGLE', pageId, {
      x: 150,
      y: 120,
      width: 40,
      height: 20,
      rotation: 15
    })
    const before = worldCorners(graph, rect.id)

    graph.reparentNode(rect.id, frame.id)

    expectSameCorners(worldCorners(graph, rect.id), before)
    const node = graph.getNode(rect.id)
    expect(node?.flipX).not.toBe(node?.flipY)
  })

  test('a rotated node moved between unrotated frames keeps its corners and rotation', () => {
    const { graph, pageId } = setup()
    const left = graph.createNode('FRAME', pageId, { x: 0, y: 0, width: 200, height: 200 })
    const right = graph.createNode('FRAME', pageId, { x: 300, y: 40, width: 200, height: 200 })
    const rect = graph.createNode('RECTANGLE', left.id, {
      x: 20,
      y: 30,
      width: 60,
      height: 20,
      rotation: 45
    })
    const before = worldCorners(graph, rect.id)

    graph.reparentNode(rect.id, right.id)

    expectSameCorners(worldCorners(graph, rect.id), before)
    const node = graph.getNode(rect.id)
    expect(node?.x).toBe(-280)
    expect(node?.y).toBe(-10)
    expect(node?.rotation).toBe(45)
  })
})

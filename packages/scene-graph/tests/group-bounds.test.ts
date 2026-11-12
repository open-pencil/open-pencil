import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorRoute,
  createConnector,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import {
  getAxisAlignedBoundsInParent,
  getAxisAlignedWorldBounds
} from '@open-pencil/scene-graph/coordinate'
import { fitEnclosingGroups, undoGroupFit } from '@open-pencil/scene-graph/group-bounds'
import type { Rect } from '@open-pencil/scene-graph/primitives'

// Live Figma 126: a group holding a rectangle, then a mask ellipse, then a larger rectangle
// measures 0,0 150×150, and moving the masked rectangle leaves it unchanged.
test('a group with a mask spans the layers below the mask and the mask', () => {
  const graph = new SceneGraph()
  const group = graph.createNode('GROUP', graph.getPages()[0].id, { width: 1, height: 1 })
  graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 20, height: 20 })
  graph.createNode('ELLIPSE', group.id, { x: 100, y: 100, width: 50, height: 50, isMask: true })
  const masked = graph.createNode('RECTANGLE', group.id, { x: 50, y: 50, width: 200, height: 200 })

  fitEnclosingGroups(graph, [group.id])
  const bounds = () => {
    const { x, y, width, height } = graph.getNode(group.id) ?? group
    return { x, y, width, height }
  }
  expect(bounds()).toEqual({ x: 0, y: 0, width: 150, height: 150 })

  graph.updateNode(masked.id, { x: 300, y: 300 })
  fitEnclosingGroups(graph, [group.id])
  expect(bounds()).toEqual({ x: 0, y: 0, width: 150, height: 150 })
})

function worldBox(graph: SceneGraph, id: string) {
  const node = graph.getNode(id)
  if (!node) throw new Error('missing layer')
  return getAxisAlignedWorldBounds(node, graph)
}

function expectBox(actual: Rect, expected: Rect) {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
  expect(actual.width).toBeCloseTo(expected.width, 6)
  expect(actual.height).toBeCloseTo(expected.height, 6)
}

/** A group turned 30° holding two rectangles, the second moved out past the group's corner. */
function rotatedGroup(transform: { rotation?: number; flipX?: boolean; flipY?: boolean }) {
  const graph = new SceneGraph()
  const group = graph.createNode('GROUP', graph.getPages()[0].id, {
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    ...transform
  })
  const a = graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 50, height: 50 })
  const b = graph.createNode('RECTANGLE', group.id, { x: 120, y: 60, width: 40, height: 30 })
  return { graph, group: group.id, a: a.id, b: b.id }
}

for (const [name, transform] of [
  ['rotated', { rotation: 30 }],
  ['flipped', { flipX: true }],
  ['rotated and flipped', { rotation: -20, flipY: true }]
] as const) {
  test(`a ${name} group fits its children in its own frame and keeps them in place`, () => {
    const { graph, group, a, b } = rotatedGroup(transform)
    const before = { a: worldBox(graph, a), b: worldBox(graph, b) }

    expect(fitEnclosingGroups(graph, [group])).not.toBeNull()
    const fitted = graph.getNode(group)
    if (!fitted) throw new Error('missing group')
    // The children's bounds in the group's frame: (0,0)…(160,90), so the group starts at their corner.
    expect(fitted.width).toBeCloseTo(160, 6)
    expect(fitted.height).toBeCloseTo(90, 6)
    expect(fitted.rotation).toBe(transform.rotation ?? 0)
    expectBox(getAxisAlignedBoundsInParent([...graph.getChildren(group)], group, graph), {
      x: 0,
      y: 0,
      width: 160,
      height: 90
    })
    expectBox(worldBox(graph, a), before.a)
    expectBox(worldBox(graph, b), before.b)
  })
}

test('a rotated group whose children start off its corner keeps them in place', () => {
  const { graph, group, a, b } = rotatedGroup({ rotation: 30 })
  graph.updateNode(a, { x: 30, y: 20 })
  const before = { a: worldBox(graph, a), b: worldBox(graph, b) }

  expect(fitEnclosingGroups(graph, [group])).not.toBeNull()
  // The children's bounds in the group's frame, (30,20)…(160,90), now start at its corner.
  expectBox(getAxisAlignedBoundsInParent([...graph.getChildren(group)], group, graph), {
    x: 0,
    y: 0,
    width: 130,
    height: 70
  })
  expectBox(worldBox(graph, a), before.a)
  expectBox(worldBox(graph, b), before.b)
})

test('a fitted rotated group fits again without change', () => {
  for (const rotation of [17, 30, 45, 123]) {
    const { graph, group, b } = rotatedGroup({ rotation })
    graph.updateNode(b, { rotation: 13 })
    fitEnclosingGroups(graph, [group])
    // Its frame leaves rounding residue in the children's bounds; that is no change.
    expect(fitEnclosingGroups(graph, [group])).toBeNull()
  }
})

test('fitting a rotated group can be undone', () => {
  const { graph, group, b } = rotatedGroup({ rotation: 30 })
  const original = { ...graph.getNode(group) }
  const fit = fitEnclosingGroups(graph, [group])
  if (!fit) throw new Error('expected a fit')
  undoGroupFit(graph, fit)
  expect(graph.getNode(group)?.width).toBe(original.width)
  expect(graph.getNode(group)?.x).toBe(original.x)
  expect(graph.getNode(b)?.x).toBe(120)
})

test("a connector's free end stays put on the canvas as its group refits, and comes back on undo", () => {
  const graph = new SceneGraph()
  const group = graph.createNode('GROUP', graph.getPages()[0].id, { width: 400, height: 400 })
  const rect = graph.createNode('RECTANGLE', group.id, { width: 100, height: 100 })
  const connector = createConnector(graph, group.id, {
    start: boundEndpoint(rect.id),
    end: freeEndpoint(300, 300)
  })
  layoutConnector(graph, connector)
  fitEnclosingGroups(graph, [group.id])
  const freeEnd = () => {
    const at = graph.getNode(group.id) ?? group
    const node = graph.getNode(connector.id)
    const end = node ? connectorRoute(graph, node)?.end.point : undefined
    return end && { x: at.x + end.x, y: at.y + end.y }
  }
  expect(freeEnd()).toEqual({ x: 300, y: 300 })

  graph.updateNode(rect.id, { x: -100, y: -100 })
  const fit = fitEnclosingGroups(graph, [group.id])
  expect(graph.getNode(group.id)?.x).toBe(-100)
  expect(freeEnd()).toEqual({ x: 300, y: 300 })

  if (fit) undoGroupFit(graph, fit)
  expect(graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 300, y: 300 })
})

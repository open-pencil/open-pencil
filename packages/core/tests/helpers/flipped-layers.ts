import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

export function solid(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

export const RED = solid(1, 0, 0)

export function worldBox(graph: SceneGraph, node: SceneNode): VisualBounds {
  const { x, y, width, height } = getAxisAlignedWorldBounds(node, graph)
  return { minX: x, minY: y, maxX: x + width, maxY: y + height }
}

export function unionBoxes(boxes: readonly VisualBounds[]): VisualBounds {
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    maxY: Math.max(...boxes.map((box) => box.maxY))
  }
}

export interface FlippedCase {
  name: string
  graph: SceneGraph
  pageId: string
  nodeId: string
  inkId: string
  bounds: VisualBounds
  ink: VisualBounds
}

function emptyPage() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  return { graph, pageId: page.id }
}

function lone(name: string, props: Partial<SceneNode>, type: 'RECTANGLE' | 'FRAME' = 'RECTANGLE') {
  const { graph, pageId } = emptyPage()
  const node = graph.createNode(type, pageId, {
    x: 40,
    y: 30,
    width: 60,
    height: 20,
    fills: RED,
    ...props
  })
  const box = worldBox(graph, node)
  return { name, graph, pageId, nodeId: node.id, inkId: node.id, bounds: box, ink: box }
}

function frameWithChildPastItsEdge(name: string, childProps: Partial<SceneNode>): FlippedCase {
  const { graph, pageId } = emptyPage()
  const frame = graph.createNode('FRAME', pageId, {
    x: 40,
    y: 30,
    width: 120,
    height: 80,
    fills: [],
    clipsContent: false
  })
  const child = graph.createNode('RECTANGLE', frame.id, {
    x: -30,
    y: 10,
    width: 60,
    height: 20,
    fills: RED,
    ...childProps
  })
  const ink = worldBox(graph, child)
  return {
    name,
    graph,
    pageId,
    nodeId: frame.id,
    inkId: child.id,
    bounds: unionBoxes([worldBox(graph, frame), ink]),
    ink
  }
}

function flippedFrameWithChildPastItsEdge(): FlippedCase {
  const { graph, pageId } = emptyPage()
  const frame = graph.createNode('FRAME', pageId, {
    x: 40,
    y: 30,
    width: 120,
    height: 80,
    fills: [],
    clipsContent: false,
    flipX: true
  })
  const child = graph.createNode('RECTANGLE', frame.id, {
    x: -30,
    y: 10,
    width: 60,
    height: 20,
    fills: RED
  })
  const ink = worldBox(graph, child)
  return {
    name: 'a flipped frame with a child past its edge',
    graph,
    pageId,
    nodeId: frame.id,
    inkId: child.id,
    bounds: unionBoxes([worldBox(graph, frame), ink]),
    ink
  }
}

function groupWithFlippedChild(): FlippedCase {
  const { graph, pageId } = emptyPage()
  const group = graph.createNode('GROUP', pageId, { x: 40, y: 30, width: 60, height: 20 })
  const child = graph.createNode('RECTANGLE', group.id, {
    width: 60,
    height: 20,
    fills: RED,
    flipX: true
  })
  const box = worldBox(graph, child)
  return {
    name: 'a group with a flipped child',
    graph,
    pageId,
    nodeId: group.id,
    inkId: child.id,
    bounds: box,
    ink: box
  }
}

export function flippedCases(): FlippedCase[] {
  return [
    lone('an unflipped rectangle', {}),
    lone('a rotated rectangle', { rotation: 30 }),
    lone('a rectangle flipped horizontally', { flipX: true }),
    lone('a rectangle flipped vertically', { flipY: true }),
    lone('a rotated and flipped rectangle', { flipX: true, rotation: 30 }),
    lone('a flipped frame', { flipX: true }, 'FRAME'),
    frameWithChildPastItsEdge('a frame with an unflipped child past its edge', {}),
    frameWithChildPastItsEdge('a frame with a flipped child past its edge', { flipX: true }),
    frameWithChildPastItsEdge('a frame with a rotated and flipped child past its edge', {
      flipY: true,
      rotation: 45
    }),
    flippedFrameWithChildPastItsEdge(),
    groupWithFlippedChild()
  ]
}

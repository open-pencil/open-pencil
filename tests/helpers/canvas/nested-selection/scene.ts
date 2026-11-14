import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** A rectangle inside a frame inside a top-level frame, the layers #1703 was reported with. */
export function createNestedSelectionScene(graph: SceneGraph, pageId: string) {
  const outer = graph.createNode('FRAME', pageId, {
    name: 'Outer',
    x: 120,
    y: 120,
    width: 360,
    height: 240,
    fills: [solid(0.94, 0.94, 0.94)]
  })
  const inner = graph.createNode('FRAME', outer.id, {
    name: 'Inner',
    x: 40,
    y: 40,
    width: 240,
    height: 140,
    fills: [solid(1, 1, 1)]
  })
  const rectangle = graph.createNode('RECTANGLE', inner.id, {
    name: 'Rectangle',
    x: 60,
    y: 40,
    width: 80,
    height: 60,
    fills: [solid(0.42, 0.78, 0.58)]
  })
  return { outer: outer.id, inner: inner.id, rectangle: rectangle.id }
}

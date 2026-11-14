import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** A 100 × 100 rectangle whose top-left, top-right and bottom-left corners are too large for it. */
export function createOversizedCornersScene(graph: SceneGraph, pageId: string): void {
  graph.createNode('RECTANGLE', pageId, {
    name: 'Oversized corners',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    independentCorners: true,
    topLeftRadius: 90,
    topRightRadius: 30,
    bottomRightRadius: 0,
    bottomLeftRadius: 60,
    fills: [solid(0.23, 0.51, 0.96)]
  })
}

import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** One large orange rectangle far from the origin, for a marquee drawn at a low zoom. */
export function createMarqueeScene(graph: SceneGraph, pageId: string) {
  const layer = graph.createNode('RECTANGLE', pageId, {
    name: 'Large',
    x: 2000,
    y: 2000,
    width: 6000,
    height: 4000,
    fills: [solid(0.95, 0.55, 0.2)]
  })
  return { layer: layer.id }
}

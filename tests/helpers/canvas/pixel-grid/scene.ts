import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** A blue rectangle at the page origin, for pixel grid specs, built in the browser. */
export function createPixelGridScene(graph: SceneGraph, pageId: string) {
  const probe = graph.createNode('RECTANGLE', pageId, {
    name: 'Probe',
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    fills: [solid(0.3, 0.5, 1)]
  })
  return { probe: probe.id }
}

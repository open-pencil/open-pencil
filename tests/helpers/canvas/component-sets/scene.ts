import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** A component set with one variant reaching 80 px past its right edge. */
export function createClippingComponentSetScene(graph: SceneGraph, pageId: string): void {
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Buttons',
    x: 120,
    y: 120,
    width: 200,
    height: 120,
    clipsContent: true,
    fills: [solid(1, 1, 1)]
  })
  graph.createNode('COMPONENT', set.id, {
    name: 'State=Wide',
    x: 20,
    y: 20,
    width: 260,
    height: 80,
    fills: [solid(0.23, 0.51, 0.96)]
  })
}

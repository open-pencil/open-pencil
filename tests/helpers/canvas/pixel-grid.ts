import type { SceneGraph } from '@open-pencil/scene-graph'

/** A blue rectangle at the page origin, for pixel grid specs, built in the browser. */
export function createPixelGridScene(graph: SceneGraph, pageId: string) {
  const probe = graph.createNode('RECTANGLE', pageId, {
    name: 'Probe',
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
  return { probe: probe.id }
}

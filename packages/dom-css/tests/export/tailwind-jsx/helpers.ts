import { sceneNodesToTailwindJSX } from '#dom-css/export/tailwind-jsx'

import type { SceneGraph } from '@open-pencil/scene-graph'

export function tw(graph: SceneGraph, nodeId: string) {
  return sceneNodesToTailwindJSX(graph, [nodeId])
}

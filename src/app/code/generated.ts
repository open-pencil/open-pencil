import { selectionToJSXWithLayers } from '@open-pencil/design-jsx'
import { sceneNodesToTailwindJSXWithLayers } from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { starterSourceFor, type CodeSource } from '@/app/code/templates'

/** Generated code and the layer behind each of its elements, in pre-order. */
export interface GeneratedCode {
  code: string
  layerIds: ReadonlyArray<string | null>
}

/** Code shown for the selection: editable Design JSX, or read-only Tailwind JSX. */
export function generatedCodeFor(
  source: Exclude<CodeSource, 'html-css'>,
  graph: SceneGraph,
  nodeIds: string[]
): GeneratedCode {
  if (nodeIds.length === 0) return { code: starterSourceFor(source), layerIds: [] }
  return source === 'tailwind-jsx'
    ? sceneNodesToTailwindJSXWithLayers(graph, nodeIds)
    : selectionToJSXWithLayers(nodeIds, graph)
}

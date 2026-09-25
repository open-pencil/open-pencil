import { selectionToJSX } from '@open-pencil/core/design-jsx'
import { sceneNodesToTailwindJSX } from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { starterSourceFor, type CodeSource } from '@/app/code/templates'

/** Code shown for the selection: editable Design JSX, or read-only Tailwind JSX. */
export function generatedSourceFor(
  source: Exclude<CodeSource, 'html-css'>,
  graph: SceneGraph,
  nodeIds: string[]
): string {
  if (nodeIds.length === 0) return starterSourceFor(source)
  return source === 'tailwind-jsx'
    ? sceneNodesToTailwindJSX(graph, nodeIds)
    : selectionToJSX(nodeIds, graph)
}

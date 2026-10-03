import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SceneOracleNode } from '../scene-oracle'
import { captureGraphOracle } from './scene'

/**
 * Capture every page of a graph, not one frame of it. Page order is the archive's, and
 * each page's nodes keep their own path prefixed by that page, so two captures of the
 * same archive line up node for node.
 */
export function captureDocumentOracle(
  graph: SceneGraph,
  sources: ReadonlyMap<string, string>
): SceneOracleNode[] {
  return graph.getPages().flatMap((page, index) =>
    captureGraphOracle(graph, page.id, sources).map((node) => ({
      ...node,
      path: [index, ...node.path]
    }))
  )
}

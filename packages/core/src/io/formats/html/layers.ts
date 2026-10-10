import type { DesignDocument } from '@open-pencil/dom-css'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { layoutAuthoredNodes } from '#core/layout'

/**
 * The layers a styled DOM describes, with the sizes and positions its layout implies. Styling
 * belongs to whoever has a CSS runtime, such as a browser or the headless runtime; building and
 * laying out the layers happens here for every caller. Safe to bundle for the browser.
 */
export function sceneGraphFromStyledHTML(
  styled: DesignDocument,
  options: { pageName?: string } = {}
): SceneGraph {
  const graph = designDocumentToSceneGraph(styled, { pageName: options.pageName })
  layoutAuthoredNodes(
    graph,
    graph.getPages().map((page) => page.id)
  )
  return graph
}

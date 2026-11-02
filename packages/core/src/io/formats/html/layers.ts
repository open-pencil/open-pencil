import type { DesignDocument } from '@open-pencil/dom-css'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { layoutAuthoredNodes } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

/**
 * The layers a styled DOM describes, with the sizes and positions its layout implies, laid out
 * once their text's fonts are prepared. Styling belongs to whoever has a CSS runtime, such as a
 * browser or the headless runtime; building and laying out the layers happens here for every
 * caller. Safe to bundle for the browser.
 */
export async function sceneGraphFromStyledHTML(
  styled: DesignDocument,
  options: { pageName?: string } = {}
): Promise<SceneGraph> {
  const graph = designDocumentToSceneGraph(styled, { pageName: options.pageName })
  await prepareGraphFonts(
    graph,
    graph.getPages().map((page) => page.id)
  )
  layoutAuthoredNodes(
    graph,
    graph.getPages().map((page) => page.id)
  )
  return graph
}

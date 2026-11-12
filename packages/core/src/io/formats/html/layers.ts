import type { DesignDocument, DesignViewport } from '@open-pencil/dom-css'
import {
  applyCSSTransforms,
  designDocumentToLayers,
  placeLayersFromLayout
} from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { layoutAuthoredNodes } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

/**
 * Placing from captured boxes only turns auto layout off or fixes sizes, so it settles; each
 * pass can expose mismatches the previous layout hid, deeper in the tree.
 */
const MAX_PLACEMENT_PASSES = 6

/** The viewport HTML is laid out in when it is imported: a common laptop's, 1440 by 900. */
export const HTML_IMPORT_VIEWPORT: DesignViewport = { width: 1440, height: 900 }

/**
 * The layers a styled DOM describes, with the sizes and positions its layout implies, laid out
 * once their text's fonts are prepared. Styling belongs to whoever has a CSS runtime, such as a
 * browser or the headless runtime; building and laying out the layers happens here for every
 * caller. When the runtime recorded where it laid each element out, auto layout is kept only
 * where it reproduces those boxes, and the rest is placed at them. Transforms turn and move
 * the laid-out layers last, as CSS applies them. Safe to bundle for the browser.
 */
export async function sceneGraphFromStyledHTML(
  styled: DesignDocument,
  options: { pageName?: string } = {}
): Promise<SceneGraph> {
  const { graph, boxes, transforms } = designDocumentToLayers(styled, {
    pageName: options.pageName
  })
  const pageIds = graph.getPages().map((page) => page.id)
  await prepareGraphFonts(graph, pageIds)
  layoutAuthoredNodes(graph, pageIds)
  for (let pass = 0; boxes.size > 0 && pass < MAX_PLACEMENT_PASSES; pass++) {
    if (placeLayersFromLayout(graph, boxes) === 0) break
    layoutAuthoredNodes(graph, pageIds)
  }
  applyCSSTransforms(graph, transforms)
  return graph
}

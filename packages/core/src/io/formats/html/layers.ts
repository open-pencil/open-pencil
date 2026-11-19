import type { DesignDocument, DesignViewport } from '@open-pencil/dom-css'
import {
  applyCSSTransforms,
  applyStacking,
  designDocumentToLayers,
  placeLayersFromLayout
} from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { WHITE } from '@open-pencil/scene-graph/constants'
import { parseCSSColor } from '@open-pencil/scene-graph/css'

import { setPageBackgrounds } from '#core/figma-api/page-backgrounds'
import type { IconMatcher } from '#core/icons/match'
import { layoutAuthoredNodes } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

import { resolvePageFontFamilies, type PageFontFamilies } from './fonts'
import { drawInlineSVGs } from './svg'

/**
 * Placing from captured boxes only fixes sizes, spaces a stack once, or turns auto layout off,
 * so it settles; each pass can expose mismatches the previous layout hid, deeper in the tree.
 * The saved sites HTML import is measured on settle within seven.
 */
const MAX_PLACEMENT_PASSES = 8

/** The viewport HTML is laid out in when it is imported: a common laptop's, 1440 by 900. */
export const HTML_IMPORT_VIEWPORT: DesignViewport = { width: 1440, height: 900 }

/**
 * The layers a styled DOM describes, with the sizes and positions its layout implies, laid out
 * once their text's fonts are prepared. Styling belongs to whoever has a CSS runtime, such as a
 * browser or the HTML engine; building and laying out the layers happens here for every
 * caller. When the runtime recorded where it laid each element out, auto layout is kept only
 * where it reproduces those boxes, and the rest is placed at them. Transforms turn and move
 * the laid-out layers last, as CSS applies them. `matchIcon` names the icons inline SVG draws
 * without the page naming them. Safe to bundle for the browser.
 */
export async function sceneGraphFromStyledHTML(
  styled: DesignDocument,
  options: {
    pageName?: string
    matchIcon?: IconMatcher
    /** The families the page's own `@font-face` rules loaded, as `loadPageFontFaces` returns them. */
    pageFamilies?: PageFontFamilies
  } = {}
): Promise<SceneGraph> {
  // Text is set in the first family of its `font-family` list there is a font for, the page's own
  // first, as a browser sets it, rather than naming one the editor cannot draw, such as
  // `Helvetica Neue` on a system without it. Families the HTML engine already resolved name a
  // single font that loads.
  await resolvePageFontFamilies(styled, options.pageFamilies)
  const { graph, boxes, transforms, svgs, stackings } = designDocumentToLayers(styled, {
    pageName: options.pageName
  })
  // The page shows what a browser paints behind the page: its own background, or white.
  const background = parseCSSColor(styled.background) ?? WHITE
  for (const page of graph.getPages()) {
    setPageBackgrounds(graph, page, [
      { type: 'SOLID', color: { ...background, a: 1 }, opacity: background.a, visible: true }
    ])
  }
  const pageIds = graph.getPages().map((page) => page.id)
  await prepareGraphFonts(graph, pageIds)
  layoutAuthoredNodes(graph, pageIds)
  for (let pass = 0; boxes.size > 0 && pass < MAX_PLACEMENT_PASSES; pass++) {
    if (placeLayersFromLayout(graph, boxes) === 0) break
    layoutAuthoredNodes(graph, pageIds)
  }
  // Once laid out, so a background lifted under a container's own fills takes its final size.
  applyStacking(graph, stackings)
  await drawInlineSVGs(graph, svgs, styled, options.matchIcon)
  applyCSSTransforms(graph, transforms)
  return graph
}

export { loadPageFontFaces } from './page-fonts'

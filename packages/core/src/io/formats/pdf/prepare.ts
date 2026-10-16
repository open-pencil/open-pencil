import type { SceneGraph } from '@open-pencil/scene-graph'

import { populateAllFigPages } from '#core/io/formats/fig'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'

import type { PDFPageSpec } from './plan'

/**
 * Design pages other than the open one may still be unread (.fig pages load on demand) and have
 * no layout yet. Read them, load the fonts their text needs, and lay them out, so every PDF page
 * is complete.
 */
export async function preparePagesForPDF(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[]
): Promise<void> {
  populateAllFigPages(graph)
  for (const spec of specs) {
    const keys = fontManager.collectFontKeys(graph, spec.nodeIds)
    await Promise.all(keys.map(([family, style]) => fontManager.loadFont(family, style)))
    computeAllLayouts(graph, spec.pageId)
  }
}

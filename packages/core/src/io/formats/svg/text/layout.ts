import type { SceneGraph } from '@open-pencil/scene-graph'

import { withPDFTextLayout } from '#core/io/formats/pdf/prepare'
import { renderNodesToSVG, type SVGExportOptions } from '#core/io/formats/svg/export'
import { prepareGraphFonts } from '#core/text/prepare'

/**
 * Layers as SVG with their text set as the canvas sets it: the fonts it draws with loaded, each
 * line on the baseline the canvas gives it, and wrapped paragraphs kept wrapped, as PDF export
 * sets them.
 */
export async function renderNodesToLaidOutSVG(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: SVGExportOptions = {}
): Promise<string | null> {
  await prepareGraphFonts(graph, nodeIds)
  return withPDFTextLayout(async (textLayout) =>
    renderNodesToSVG(graph, pageId, nodeIds, { textLayout, ...options })
  )
}

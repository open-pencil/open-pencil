import { weightToStyle, type SceneGraph } from '@open-pencil/scene-graph'

import { shapeText } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { populateAllFigPages } from '#core/io/formats/fig'
import type { SVGTextLayout } from '#core/io/formats/svg'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'

import type { PDFFontLoader } from './fonts'
import type { PDFPageSpec } from './plan'

/** Loads the fonts the text of these pages needs. */
export async function loadPDFPageFonts(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[]
): Promise<void> {
  for (const spec of specs) {
    const keys = fontManager.collectFontKeys(graph, spec.nodeIds)
    await Promise.all(keys.map(([family, style]) => fontManager.loadFont(family, style)))
  }
}

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
  await loadPDFPageFonts(graph, specs)
  for (const spec of specs) computeAllLayouts(graph, spec.pageId)
}

/** The font file of a face, from the same font manager the canvas draws with. */
export const loadPDFFont: PDFFontLoader = (face) =>
  fontManager.loadFont(face.family, weightToStyle(face.weight, face.italic))

/**
 * Runs `render` with the line breaks the canvas gives each text node (same paragraph builder and
 * fonts), so a wrapped paragraph stays wrapped in the PDF. Without CanvasKit, `render` gets no
 * layout and each text node is exported on one line.
 */
export async function withPDFTextLayout<T>(
  render: (textLayout: SVGTextLayout | undefined) => Promise<T>
): Promise<T> {
  const ck = await getCanvasKit().catch(() => null)
  if (!ck) return render(undefined)
  const reusable = fontManager.providerFor(ck)
  const provider = reusable ?? ck.TypefaceFontProvider.Make()
  if (!reusable) fontManager.attachProvider(ck, provider)
  try {
    return await render((node) => {
      const shaped = shapeText(ck, provider, node)
      if (!shaped?.baselines.length) return null
      return shaped.baselines.map((line) => ({
        start: line.firstCharacter,
        end: line.endCharacter,
        x: line.position.x,
        y: line.position.y,
        width: line.width
      }))
    })
  } finally {
    if (!reusable) {
      fontManager.detachProvider(provider)
      provider.delete()
    }
  }
}

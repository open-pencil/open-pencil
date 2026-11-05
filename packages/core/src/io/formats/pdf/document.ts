import type { SceneGraph } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'

import { renderPagesToPDFDetailed, type PDFExportResult } from './export'
import type { PDFPageSpec } from './plan'
import { pdfFontFaces, preparePagesForPDF, preparePDFFonts, withPDFTextLayout } from './prepare'

export interface PDFDocumentOptions {
  /** Embed the font files the text uses; without them, text uses standard PDF fonts. */
  embedFonts: boolean
  /** Lay the pages out first, as pages other than the open one have no layout yet. */
  layOutPages?: boolean
  title?: string
}

/**
 * A PDF of the pages as the canvas draws them: the fonts their text uses loaded, and each
 * paragraph broken into the lines the canvas breaks it into. Null when no page shows anything.
 */
export async function exportPDFDocument(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  options: PDFDocumentOptions
): Promise<PDFExportResult | null> {
  const status = options.layOutPages
    ? await preparePagesForPDF(graph, specs)
    : await preparePDFFonts(graph, specs)
  const fonts = options.embedFonts ? pdfFontFaces(status) : undefined
  return withPDFTextLayout((textLayout) =>
    renderPagesToPDFDetailed(graph, specs, {
      fonts,
      textLayout,
      fallbackFile: (family, style, file) =>
        file === 0
          ? fontManager.loadedData(family, style)
          : (fontManager.shardData(family, style)[file - 1] ?? null),
      title: options.title
    })
  )
}

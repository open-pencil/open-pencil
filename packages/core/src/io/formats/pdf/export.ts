import type { PDFDocument } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas'
import { exportBounds, prepareSelectionRenderGraph } from '#core/io/formats/raster/render'
import { extractExportGraph } from '#core/io/subgraph'

import type { PDFPageSpec } from './plan'

/**
 * Resolution, in dots per inch of the page, of what PDF cannot draw as vectors and Skia draws as
 * an image: blurs, shadows, noise, and shader fills. Twice the page's own 72 points per inch.
 */
export const PDF_RASTER_DPI = 144

export interface PDFExportOptions {
  title?: string
}

export interface PDFExportResult {
  data: Uint8Array
  /** The pages written, in order. Pages with nothing visible are skipped. */
  pages: Array<{ label?: string; width: number; height: number }>
}

/**
 * A PDF with one page per spec, each sized to what its layers draw, drawn by the renderer as the
 * canvas draws them: text in its embedded fonts, searchable, and everything else as vectors where
 * PDF has them. Null when no page has anything visible. The renderer must have the pages' fonts
 * and layout ready, as `exportPDFDocument` prepares them.
 */
export function renderPagesToPDF(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  options: PDFExportOptions = {}
): PDFExportResult | null {
  const doc = new renderer.ck.PDFDocument(options.title ?? '', 'OpenPencil', PDF_RASTER_DPI)
  try {
    const pages = specs.flatMap((spec) => drawPage(doc, renderer, graph, spec) ?? [])
    if (pages.length === 0) {
      doc.abort()
      return null
    }
    const data = doc.close()
    // Null only for a document closed or aborted before, which this one is not.
    if (!data) throw new Error('The PDF document was closed before its pages were written')
    return { data, pages }
  } finally {
    doc.delete()
  }
}

/** Draws the spec's layers on a page of their own, as PNG export draws them. */
function drawPage(
  doc: PDFDocument,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  spec: PDFPageSpec
): PDFExportResult['pages'][number] | null {
  const bounds = exportBounds(graph, spec.nodeIds)
  if (!bounds) return null
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width <= 0 || height <= 0) return null

  // Layers draw by themselves, without the page behind them, clipped by the frames around them.
  const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds: spec.nodeIds })
  if (!extracted.pageId) return null
  prepareSelectionRenderGraph(graph, extracted.graph, extracted.pageId, spec.nodeIds)

  const canvas = doc.beginPage(width, height)
  if (!canvas) throw new Error('The PDF document was closed before its pages were drawn')
  canvas.translate(-bounds.minX, -bounds.minY)
  renderer.renderSceneToCanvas(canvas, extracted.graph, extracted.pageId)
  doc.endPage()
  return { label: spec.label, width, height }
}

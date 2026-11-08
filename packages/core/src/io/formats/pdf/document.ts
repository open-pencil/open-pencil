import { groupBy } from 'es-toolkit'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas'
import { populateFigPage } from '#core/io/formats/fig'
import { withTextInkMeasurer } from '#core/text/ink'

import { renderPagesToPDF, type PDFExportOptions, type PDFExportResult } from './export'
import type { PDFPageSpec } from './plan'

/**
 * Design pages other than the open one may still be unread, since `.fig` pages load on demand.
 * Reads the pages a `pages` export asks for, or every page, so planning sees their layers.
 */
export function readPDFPages(graph: SceneGraph, pageIds?: readonly string[]): void {
  // No ids, or an empty list, exports every page, as planPDFPages reads them.
  const ids = pageIds?.length ? pageIds : graph.getPages().map((page) => page.id)
  for (const pageId of ids) {
    populateFigPage(graph, pageId)
  }
}

export interface PDFDocumentOptions extends PDFExportOptions {
  /** The host's renderer, such as the editor's; without one, the process's headless renderer. */
  renderer?: SkiaRenderer | null
}

/**
 * A PDF of the pages as the canvas draws them: each design page's fonts loaded and its layout
 * computed first, as pages other than the open one may have neither yet, and each layer's bounds
 * taken by the ink of its text. Null when no page shows anything.
 */
export async function exportPDFDocument(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  { renderer: hostRenderer, ...options }: PDFDocumentOptions = {}
): Promise<PDFExportResult | null> {
  const renderer =
    hostRenderer ??
    (await (await import('#core/io/formats/raster/headless')).headlessExportRenderer())
  const byPage = groupBy(specs, (spec) => spec.pageId)
  for (const [pageId, pageSpecs] of Object.entries(byPage)) {
    await renderer.prepareForExport(
      graph,
      pageId,
      pageSpecs.flatMap((spec) => spec.nodeIds)
    )
  }
  return withTextInkMeasurer(
    (node) => renderer.measureTextInk(node),
    () => renderPagesToPDF(renderer, graph, specs, options)
  )
}

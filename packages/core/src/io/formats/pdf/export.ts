import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeContentBounds } from '#core/io/formats/raster'
import { renderNodesToSVG, type SVGTextLayout } from '#core/io/formats/svg'

import { embedFonts, type PDFFontLoader, type PDFFontReport } from './fonts'
import type { PDFPageSpec } from './plan'

export interface PDFExportOptions {
  title?: string
  /** Embeds the font file of each face the text uses; without it text uses standard PDF fonts. */
  fonts?: PDFFontLoader
  /** Line breaks of text nodes as the editor laid them out, so paragraphs stay wrapped. */
  textLayout?: SVGTextLayout
}

export interface PDFExportResult {
  data: Uint8Array
  /** The pages written, in order. Pages with nothing visible are skipped. */
  pages: Array<{ label?: string; width: number; height: number }>
  /** Embedded and fallback faces, when `fonts` was given. */
  fonts?: PDFFontReport
}

interface PreparedPage {
  spec: PDFPageSpec
  svgElement: Element
  width: number
  height: number
}

function preparePage(
  graph: SceneGraph,
  spec: PDFPageSpec,
  textLayout: SVGTextLayout | undefined
): PreparedPage | null {
  const svg = renderNodesToSVG(graph, spec.pageId, spec.nodeIds, {
    xmlDeclaration: false,
    textLayout
  })
  if (!svg) return null

  const bounds = computeContentBounds(graph, spec.nodeIds)
  if (!bounds) return null

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width <= 0 || height <= 0) return null

  const svgDoc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (svgDoc.querySelector('parsererror')) return null

  return { spec, svgElement: svgDoc.documentElement, width, height }
}

const orientationOf = (page: PreparedPage) => (page.width > page.height ? 'landscape' : 'portrait')

/**
 * A PDF with one page per spec, each sized to its content. Null when no page has anything visible.
 */
export async function renderPagesToPDFDetailed(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  options: PDFExportOptions = {}
): Promise<PDFExportResult | null> {
  const prepared = specs
    .map((spec) => preparePage(graph, spec, options.textLayout))
    .filter((page): page is PreparedPage => page !== null)
  if (prepared.length === 0) return null
  const first = prepared[0]

  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  const doc = new jsPDF({
    orientation: orientationOf(first),
    unit: 'pt',
    format: [first.width, first.height],
    compress: true
  })

  if (options.title) {
    doc.setProperties({ title: options.title })
  }

  const fonts = options.fonts
    ? await embedFonts(
        doc,
        prepared.map((page) => page.svgElement),
        options.fonts
      )
    : undefined

  for (const [index, page] of prepared.entries()) {
    if (index > 0) doc.addPage([page.width, page.height], orientationOf(page))
    await svg2pdf(page.svgElement, doc, { x: 0, y: 0, width: page.width, height: page.height })
  }

  return {
    data: new Uint8Array(doc.output('arraybuffer')),
    pages: prepared.map((page) => ({
      label: page.spec.label,
      width: page.width,
      height: page.height
    })),
    ...(fonts ? { fonts } : {})
  }
}

/** One PDF page holding all `nodeIds`. */
export async function renderNodesToPDF(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: PDFExportOptions = {}
): Promise<Uint8Array | null> {
  const result = await renderPagesToPDFDetailed(graph, [{ pageId, nodeIds }], options)
  return result?.data ?? null
}

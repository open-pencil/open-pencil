import type { SceneGraph } from '@open-pencil/scene-graph'

import { computeContentBounds } from '#core/io/formats/raster'
import { renderNodesToSVG, type SVGExportOptions, type SVGTextLayout } from '#core/io/formats/svg'

import { withPDFDOM, type SVGPageParser } from './dom'
import {
  cutFontInstances,
  embeddedFontAlias,
  planFontEmbedding,
  registerEmbeddedFonts,
  type PDFFallbackFontFile,
  type PDFFontFace,
  type PDFFontReport
} from './fonts'
import type { PDFPageSpec } from './plan'

export interface PDFExportOptions {
  title?: string
  /** The faces the text uses, to embed their files; without them text uses standard PDF fonts. */
  fonts?: readonly PDFFontFace[]
  /** Line breaks of text nodes as the editor laid them out, so paragraphs stay wrapped. */
  textLayout?: SVGTextLayout
  /** The files of fallback faces the text layout draws characters in, to embed them too. */
  fallbackFile?: PDFFallbackFontFile
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

type PageSVGOptions = Pick<SVGExportOptions, 'textLayout' | 'fontAlias'>

function preparePage(
  graph: SceneGraph,
  spec: PDFPageSpec,
  svgOptions: PageSVGOptions,
  parse: SVGPageParser
): PreparedPage | null {
  const svg = renderNodesToSVG(graph, spec.pageId, spec.nodeIds, {
    xmlDeclaration: false,
    ...svgOptions
  })
  if (!svg) return null

  const bounds = computeContentBounds(graph, spec.nodeIds)
  if (!bounds) return null

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width <= 0 || height <= 0) return null

  const svgElement = parse(svg)
  return svgElement ? { spec, svgElement, width, height } : null
}

const orientationOf = (page: PreparedPage) => (page.width > page.height ? 'landscape' : 'portrait')

/**
 * A PDF with one page per spec, each sized to its content. Null when no page has anything visible.
 */
export function renderPagesToPDFDetailed(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  options: PDFExportOptions = {}
): Promise<PDFExportResult | null> {
  return withPDFDOM((parse) => renderPages(graph, specs, options, parse))
}

async function renderPages(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[],
  options: PDFExportOptions,
  parse: SVGPageParser
): Promise<PDFExportResult | null> {
  const embedding = options.fonts ? planFontEmbedding(options.fonts, options.fallbackFile) : null
  const svgOptions: PageSVGOptions = {
    textLayout: options.textLayout,
    fontAlias: embedding ? embeddedFontAlias(embedding) : undefined
  }
  const preparePages = () =>
    specs
      .map((spec) => preparePage(graph, spec, svgOptions, parse))
      .filter((page): page is PreparedPage => page !== null)
  let prepared = preparePages()
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

  // The pages name the variable instances they draw, which are cut now. jsPDF reads a font file
  // when it is registered, so a face it refuses is only known then. Either way, the pages are
  // written again without the names of faces that are not embedded.
  if (embedding) {
    const cut = await cutFontInstances(embedding)
    if (!registerEmbeddedFonts(doc, embedding) || !cut) prepared = preparePages()
  }

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
    ...(embedding ? { fonts: embedding.report } : {})
  }
}

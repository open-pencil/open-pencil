import { computeContentBounds } from '#core/io/formats/raster'
import { renderNodesToSVG } from '#core/io/formats/svg'

import type { SceneGraph } from '#core/scene-graph'

export interface PDFExportOptions {
  title?: string
}

export async function renderNodesToPDF(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: PDFExportOptions = {}
): Promise<Uint8Array | null> {
  const svg = renderNodesToSVG(graph, pageId, nodeIds, { xmlDeclaration: false })
  if (!svg) return null

  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width <= 0 || height <= 0) return null

  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  const doc = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height],
    compress: true
  })

  if (options.title) {
    doc.setProperties({ title: options.title })
  }

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
  const svgElement = svgDoc.documentElement

  const parseError = svgDoc.querySelector('parsererror')
  if (parseError) return null

  await svg2pdf(svgElement, doc, { x: 0, y: 0, width, height })

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}

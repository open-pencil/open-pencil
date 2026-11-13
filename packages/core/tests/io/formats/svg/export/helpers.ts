import { renderNodesToSVG, type SVGExportOptions } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { firstPageId } from '@open-pencil/test-support/scene'

export function exportSVG(graph: SceneGraph, nodeIds: string[], xmlDecl = false): string | null {
  return renderNodesToSVG(graph, firstPageId(graph), nodeIds, { xmlDeclaration: xmlDecl })
}

export function exportSVGOrThrow(graph: SceneGraph, nodeIds: string[], xmlDecl = false): string {
  return expectDefined(exportSVG(graph, nodeIds, xmlDecl), 'SVG output')
}

export function renderNodesToSVGOrThrow(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: Parameters<typeof renderNodesToSVG>[3]
): string {
  return expectDefined(renderNodesToSVG(graph, pageId, nodeIds, options), 'SVG output')
}

/** The SVG the layers `build` makes on a fresh page export to, without an XML declaration. */
export function svgOf(
  build: (graph: SceneGraph, pageId: string) => string[],
  options: SVGExportOptions = {}
): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  return expectDefined(
    renderNodesToSVG(graph, pageId, build(graph, pageId), { xmlDeclaration: false, ...options }),
    'SVG output'
  )
}

export function rects(svg: string): string[] {
  return Array.from(svg.matchAll(/<rect\b[^>]*>/g), ([element]) => element)
}

export function paths(svg: string): string[] {
  return Array.from(svg.matchAll(/<path\b[^>]*>/g), ([element]) => element)
}

/** A move command, enough for a vector geometry to export as a path. */
export function moveTo(x: number, y: number): Uint8Array {
  const blob = new Uint8Array(9)
  blob[0] = 1
  const view = new DataView(blob.buffer)
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return blob
}

export function solid(r: number, g: number, b: number, a: number, opacity: number): Fill {
  return { type: 'SOLID', color: { r, g, b, a }, opacity, visible: true }
}

/** A 2 px black stroke centered on its path. */
export const BLACK_STROKE: Stroke = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  weight: 2,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

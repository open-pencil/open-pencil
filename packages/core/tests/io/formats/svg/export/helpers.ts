import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import type { SceneGraph } from '@open-pencil/scene-graph'
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

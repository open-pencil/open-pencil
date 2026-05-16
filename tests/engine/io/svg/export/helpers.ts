import { SceneGraph, renderNodesToSVG } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

export function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

export function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

export function exportSVG(graph: SceneGraph, nodeIds: string[], xmlDecl = false): string | null {
  return renderNodesToSVG(graph, pageId(graph), nodeIds, { xmlDeclaration: xmlDecl })
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

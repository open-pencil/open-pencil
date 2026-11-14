import { findPageId } from './subgraph'
import type { ExportRequest } from './types'

/** The layers an export draws, all on one page. */
export interface ExportNodes {
  pageId: string
  nodeIds: string[]
}

/** The one layer an export target names, or null for a document, page, or several layers. */
export function singleExportNode(target: ExportRequest['target']): string | null {
  if (target.scope === 'node') return target.nodeId
  if (target.scope === 'selection' && target.nodeIds.length === 1) return target.nodeIds[0]
  return null
}

/**
 * The page and layers an export request draws: a document's first page, a page's layers, or the
 * layers selected, which must stay on one page; null when the target is gone.
 */
export function resolveExportNodes(request: ExportRequest): ExportNodes | null {
  switch (request.target.scope) {
    case 'document': {
      const page = request.graph.getPages()[0]
      return { pageId: page.id, nodeIds: page.childIds }
    }
    case 'page': {
      const page = request.graph.getNode(request.target.pageId)
      if (!page) return null
      return { pageId: page.id, nodeIds: page.childIds }
    }
    case 'selection': {
      const first = request.target.nodeIds[0]
      if (!first) return null
      const pageId = findPageId(request.graph, first)
      if (!pageId) return null
      if (!request.target.nodeIds.every((nodeId) => findPageId(request.graph, nodeId) === pageId)) {
        throw new Error('Export selection must stay on a single page')
      }
      return { pageId, nodeIds: request.target.nodeIds }
    }
    case 'node':
      return resolveExportNodes({
        ...request,
        target: { scope: 'selection', nodeIds: [request.target.nodeId] }
      })
    default:
      return null
  }
}

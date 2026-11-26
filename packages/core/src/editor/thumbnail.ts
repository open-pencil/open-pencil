import {
  canBeDocumentThumbnail,
  documentThumbnail,
  documentThumbnailId,
  setDocumentThumbnail
} from '@open-pencil/scene-graph/thumbnail'

import type { EditorContext } from './types'

/** The layer a document shows as its thumbnail, as Figma's Set as thumbnail chooses it. */
export function createThumbnailActions(ctx: EditorContext) {
  /** The layer chosen as the document's thumbnail, or null when it shows its cover page. */
  function getDocumentThumbnail(): string | null {
    return documentThumbnail(ctx.graph)?.id ?? null
  }

  /**
   * Shows `nodeId` as the document's thumbnail, or its cover page again with null, as one undo
   * step. False when `nodeId` cannot be a thumbnail or already is one.
   */
  function setDocumentThumbnailNode(nodeId: string | null): boolean {
    const graph = ctx.graph
    // What is stored, even a layer on a page not loaded yet, so undo puts that choice back.
    const previous = documentThumbnailId(graph)
    if (previous === nodeId) return false
    if (nodeId !== null) {
      const node = graph.getNode(nodeId)
      if (!node || !canBeDocumentThumbnail(graph, node)) return false
    }
    setDocumentThumbnail(graph, nodeId)
    ctx.undo.push({
      label: nodeId === null ? 'Restore default thumbnail' : 'Set as thumbnail',
      forward: () => setDocumentThumbnail(graph, nodeId),
      inverse: () => setDocumentThumbnail(graph, previous)
    })
    return true
  }

  return { getDocumentThumbnail, setDocumentThumbnailNode }
}

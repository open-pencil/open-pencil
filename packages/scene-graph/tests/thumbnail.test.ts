import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  canBeDocumentThumbnail,
  documentThumbnail,
  setDocumentThumbnail
} from '@open-pencil/scene-graph/thumbnail'

function document() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const cover = graph.createNode('FRAME', page.id, { name: 'Cover', width: 1920, height: 960 })
  const nested = graph.createNode('FRAME', cover.id, { name: 'Card' })
  const shape = graph.createNode('RECTANGLE', page.id, { name: 'Shape' })
  return { graph, page, cover, nested, shape }
}

describe('document thumbnail', () => {
  test('a frame placed on a page can be the thumbnail; a nested frame or a shape cannot', () => {
    const { graph, cover, nested, shape } = document()
    expect(canBeDocumentThumbnail(graph, cover)).toBe(true)
    expect(canBeDocumentThumbnail(graph, nested)).toBe(false)
    expect(canBeDocumentThumbnail(graph, shape)).toBe(false)
  })

  test('a frame on an internal page cannot be the thumbnail', () => {
    const graph = new SceneGraph()
    const internal = graph.createNode('CANVAS', graph.rootId, { internalOnly: true })
    const frame = graph.createNode('FRAME', internal.id)
    expect(canBeDocumentThumbnail(graph, frame)).toBe(false)
  })

  test('is stored on the document node and cleared with null', () => {
    const { graph, cover } = document()
    expect(documentThumbnail(graph)).toBeNull()
    setDocumentThumbnail(graph, cover.id)
    expect(documentThumbnail(graph)?.id).toBe(cover.id)
    setDocumentThumbnail(graph, null)
    expect(documentThumbnail(graph)).toBeNull()
  })

  test('a chosen frame that was deleted or moved into another frame no longer counts', () => {
    const { graph, page, cover } = document()
    const other = graph.createNode('FRAME', page.id, { name: 'Other' })
    setDocumentThumbnail(graph, other.id)
    graph.reparentNode(other.id, cover.id)
    expect(documentThumbnail(graph)).toBeNull()
    setDocumentThumbnail(graph, cover.id)
    graph.deleteNode(cover.id)
    expect(documentThumbnail(graph)).toBeNull()
  })
})

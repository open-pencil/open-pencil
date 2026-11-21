import { describe, expect, test } from 'bun:test'

import { designToJSON } from '#design-json/export'

import { SceneGraph, type CommentThread } from '@open-pencil/scene-graph'
import { writeComments } from '@open-pencil/scene-graph/comments'
import { internalCanvas } from '@open-pencil/scene-graph/shared-styles'

const WHITE = { r: 1, g: 1, b: 1, a: 1 }

/** A page with a frame holding a rectangle filled white. */
function design() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { name: 'Card' })
  const box = graph.createNode('RECTANGLE', frame.id, {
    name: 'Box',
    fills: [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }]
  })
  return { graph, page, frame, box }
}

function thread(id: string, pageId: string, nodeId: string, deleted = false): CommentThread {
  const at = '2026-11-21T12:00:00.000Z'
  return {
    id,
    pageId,
    nodeId,
    x: 0,
    y: 0,
    author: 'Ana',
    text: `Comment ${id}`,
    createdAt: at,
    updatedAt: at,
    resolved: false,
    deleted,
    replies: []
  }
}

describe('design JSON beyond the layers', () => {
  test('writes the shared styles the layers use, whole, by the ID they link them by', () => {
    const { graph, box } = design()
    const style = graph.createNode('RECTANGLE', internalCanvas(graph).id, {
      name: 'Brand/White',
      sharedStyleType: 'FILL'
    })
    graph.updateNode(style.id, { source: { ...style.source, id: 'S:white' } })
    graph.updateNode(box.id, { fillStyleId: 'S:white' })
    const json = designToJSON(graph, [box.id])
    expect(Object.keys(json.styles)).toEqual(['S:white'])
    expect(json.styles['S:white']).toMatchObject({ id: style.id, name: 'Brand/White' })
  })

  test('computes each layer’s variable modes and the values its variables resolve to there', () => {
    const { graph, frame, box } = design()
    const collection = graph.createCollection('Theme')
    const dark = graph.createMode(collection.id, 'Dark')
    if (!dark) throw new Error('Expected a mode')
    const surface = graph.createVariable('surface', 'COLOR', collection.id, WHITE)
    surface.valuesByMode[dark] = { r: 0, g: 0, b: 0, a: 1 }
    graph.bindVariable(box.id, 'fills/0/color', surface.id)
    graph.updateNode(frame.id, { variableModes: { [collection.id]: dark } })
    const [card] = designToJSON(graph, [frame.id]).layers
    expect(card.children?.[0].computed).toEqual({
      variableModes: { [collection.id]: dark },
      variables: { [surface.id]: { r: 0, g: 0, b: 0, a: 1 } },
      commentThreadIds: []
    })
    expect(designToJSON(graph, [box.id], { computed: false }).layers[0].computed).toBeUndefined()
  })

  test('writes every comment thread and names the live ones pinned to each layer', () => {
    const { graph, page, frame } = design()
    writeComments(graph, [
      thread('t1', page.id, frame.id),
      thread('t2', page.id, frame.id, true),
      thread('t3', page.id, 'elsewhere')
    ])
    const json = designToJSON(graph, [frame.id])
    expect(json.comments.map((comment) => comment.id)).toEqual(['t1', 't2', 't3'])
    expect(json.comments[0]).toMatchObject({ text: 'Comment t1', author: 'Ana', replies: [] })
    expect(json.layers[0].computed?.commentThreadIds).toEqual(['t1'])
    expect(designToJSON(graph, [frame.id], { comments: false }).comments).toEqual([])
  })

  test('describes the document: its pages, the internal one included, and its libraries', () => {
    const { graph, page, frame } = design()
    const styles = internalCanvas(graph)
    const { document } = designToJSON(graph, [frame.id])
    expect(document).toMatchObject({ rootId: graph.rootId, kind: 'design', colorSpace: 'srgb' })
    expect(document.pages).toEqual([
      { id: page.id, name: page.name, internalOnly: false },
      { id: styles.id, name: styles.name, internalOnly: true }
    ])
    expect(document.enabledLibraries).toEqual({})
  })

  test('adds the .fig schema only when asked for', () => {
    const { graph, frame } = design()
    graph.figSchemaDeflated = new Uint8Array([1, 2, 3])
    expect(designToJSON(graph, [frame.id]).document).not.toHaveProperty('figSchema')
    expect(designToJSON(graph, [frame.id], { figSchema: true }).document.figSchema).toEqual({
      byteLength: 3,
      base64: 'AQID'
    })
    graph.figSchemaDeflated = null
    expect(designToJSON(graph, [frame.id], { figSchema: true }).document.figSchema).toBeNull()
  })
})

import { describe, expect, test } from 'bun:test'

import {
  commentAnchor,
  commentPosition,
  readComments,
  SceneGraph,
  writeComments,
  type CommentThread
} from '@open-pencil/scene-graph'

function thread(id: string, patch: Partial<CommentThread> = {}): CommentThread {
  return {
    id,
    pageId: '0:1',
    x: 10,
    y: 20,
    author: 'Ada',
    text: id,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    resolved: false,
    replies: [],
    ...patch
  }
}

describe('document comments', () => {
  test('skip malformed threads and read damaged data as no comments', () => {
    const graph = new SceneGraph()
    const root = graph.getNode(graph.rootId)
    if (!root) throw new Error('Root missing')
    const store = (value: string) =>
      graph.updateNode(root.id, {
        pluginData: [{ pluginId: 'open-pencil', key: 'comments', value }]
      })

    store('not json')
    expect(readComments(graph)).toEqual([])
    store(JSON.stringify([thread('a'), { id: 3 }, 'b']))
    expect(readComments(graph).map((entry) => entry.id)).toEqual(['a'])
  })

  test('removing every thread leaves no entry behind', () => {
    const graph = new SceneGraph()
    writeComments(graph, [thread('a')])
    writeComments(graph, [])
    expect(graph.getNode(graph.rootId)?.pluginData).toEqual([])
  })

  test('a pin follows the top-level layer under it and stays put without one', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Page missing')
    const frame = graph.createNode('FRAME', page.id, { x: 100, y: 50, width: 200, height: 100 })
    graph.createNode('RECTANGLE', frame.id, { x: 10, y: 10, width: 20, height: 20 })

    const anchor = commentAnchor(graph, page.id, { x: 115, y: 65 })
    expect(anchor).toMatchObject({ nodeId: frame.id, offsetX: 15, offsetY: 15 })
    const pinned = { ...thread('a', { pageId: page.id }), ...anchor }
    graph.updateNode(frame.id, { x: 400 })
    expect(commentPosition(graph, pinned)).toEqual({ x: 415, y: 65 })

    expect(commentAnchor(graph, page.id, { x: 900, y: 900 }).nodeId).toBeNull()
  })

  test('inside a section a pin follows the frame it is on, not the whole section', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Page missing')
    const section = graph.createNode('SECTION', page.id, { x: 0, y: 0, width: 800, height: 600 })
    const frame = graph.createNode('FRAME', section.id, { x: 100, y: 100, width: 200, height: 100 })
    graph.createNode('RECTANGLE', frame.id, { x: 10, y: 10, width: 20, height: 20 })

    expect(commentAnchor(graph, page.id, { x: 115, y: 115 }).nodeId).toBe(frame.id)
  })
})


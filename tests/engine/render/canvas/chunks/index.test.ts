import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { RenderChunkIndex } from '#core/canvas/renderer/chunks'

function graphWithNodes(count: number): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  const frame = graph.createNode('FRAME', page.id, {
    x: 0,
    y: 0,
    width: count * 20,
    height: 20
  })
  for (let index = 0; index < count; index++) {
    graph.createNode('RECTANGLE', frame.id, {
      x: index * 20,
      y: 0,
      width: 10,
      height: 10
    })
  }
  return { graph, pageId: page.id }
}

describe('render chunk spatial index', () => {
  test('splits oversized top-level subtrees into bounded chunks', () => {
    const { graph, pageId } = graphWithNodes(1_000)
    const { index, stats } = RenderChunkIndex.build(graph, pageId)

    expect(stats.nodesVisited).toBe(1_001)
    expect(stats.chunksBuilt).toBe(1_001)
    expect(stats.maximumChunkNodes).toBe(1)
    expect(index.size()).toBe(1_001)
    expect(index.getChunksForNode(graph.getChildren(pageId)[0]?.id ?? '')[0]?.kind).toBe('self')
    index.dispose()
  })

  test('queries only chunks intersecting a world-space rectangle in painter order', () => {
    const { graph, pageId } = graphWithNodes(1_000)
    const { index } = RenderChunkIndex.build(graph, pageId)
    const found = index.search({ minX: 1_000, minY: -1, maxX: 1_090, maxY: 11 })

    expect(found.length).toBeLessThan(10)
    expect(found.map((chunk) => chunk.painterOrder)).toEqual(
      [...found].map((chunk) => chunk.painterOrder).sort((a, b) => a - b)
    )
    expect(found.every((chunk) => chunk.maxX >= 1_000 && chunk.minX <= 1_090)).toBe(true)
    index.dispose()
  })

  test('updates an owning chunk bounds without rebuilding the index', () => {
    const { graph, pageId } = graphWithNodes(1_000)
    const { index } = RenderChunkIndex.build(graph, pageId)
    const frame = graph.getChildren(pageId)[0]
    if (!frame) throw new Error('Expected frame')
    graph.updateNode(frame.id, { x: 400 })

    expect(index.updateNode(graph, frame.id)).toBe(1)
    expect(index.getChunksForNode(frame.id)[0]?.minX).toBe(400)
    index.dispose()
  })

  test('indexes subtree descendants and transform ancestors as chunk dependencies', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const ancestor = graph.createNode('FRAME', page.id, { x: 20, y: 20 })
    const root = graph.createNode('FRAME', ancestor.id)
    const child = graph.createNode('RECTANGLE', root.id)
    const { index } = RenderChunkIndex.build(graph, page.id)
    try {
      expect(index.getChunksDependingOnNode(child.id).map((chunk) => chunk.nodeId)).toContain(
        ancestor.id
      )
      expect(index.getChunksDependingOnNode(ancestor.id).length).toBeGreaterThan(0)
    } finally {
      index.dispose()
    }
  })

  test('keeps a small top-level subtree as one retained chunk', () => {
    const { graph, pageId } = graphWithNodes(20)
    const { index, stats } = RenderChunkIndex.build(graph, pageId)

    expect(stats.chunksBuilt).toBe(1)
    expect(stats.maximumChunkNodes).toBe(21)
    expect(index.size()).toBe(1)
    index.dispose()
  })
})

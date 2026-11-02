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

  test('composes translated square clips into one box and keeps shaped clips by ancestor', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const outer = graph.createNode('FRAME', page.id, {
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      clipsContent: true
    })
    const inner = graph.createNode('FRAME', outer.id, {
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      clipsContent: true
    })
    // Enough layers that both frames split, so the leaves carry the clips of both ancestors.
    for (let index = 0; index < 40; index++) {
      graph.createNode('RECTANGLE', inner.id, { x: index, y: 0, width: 10, height: 10 })
    }
    const leafId = graph.getChildren(inner.id)[0]?.id ?? ''
    const built = RenderChunkIndex.build(graph, page.id)
    try {
      const leaf = built.index.getChunksForNode(leafId)[0]
      expect(leaf?.context.clipRect).toEqual({ minX: 30, minY: 30, maxX: 110, maxY: 110 })
      expect(leaf?.context.ancestorClipIds).toEqual([])
    } finally {
      built.index.dispose()
    }

    graph.updateNode(inner.id, { rotation: 45 })
    const rotated = RenderChunkIndex.build(graph, page.id)
    try {
      const leaf = rotated.index.getChunksForNode(leafId)[0]
      expect(leaf?.context.clipRect).toEqual({ minX: 10, minY: 10, maxX: 110, maxY: 110 })
      expect(leaf?.context.ancestorClipIds).toEqual([inner.id])
    } finally {
      rotated.index.dispose()
    }
  })

  test('rebuilds one page child at a time and keeps the draw order of the others', () => {
    const { graph, pageId } = graphWithNodes(40)
    const first = graph.getChildren(pageId)[0]
    if (!first) throw new Error('Expected a page child')
    const second = graph.createNode('RECTANGLE', pageId, { x: 0, y: 100, width: 10, height: 10 })
    const { index } = RenderChunkIndex.build(graph, pageId)
    try {
      const before = index.size()
      expect(index.hasTop(first.id)).toBe(true)
      const added = graph.createNode('RECTANGLE', first.id, { x: 900, y: 0, width: 10, height: 10 })
      const { removed, added: rebuilt } = index.rebuildTop(graph, pageId, first.id)
      expect(removed.length).toBe(before - 1)
      expect(rebuilt.length).toBe(before)
      expect(index.size()).toBe(before + 1)
      expect(index.getChunksForNode(added.id)).toHaveLength(1)
      expect(index.getChunksDependingOnNode(first.id).length).toBe(before)
      // The second page child still draws after everything in the first.
      const secondChunk = index.getChunksForNode(second.id)[0]
      for (const chunk of rebuilt)
        expect(chunk.painterOrder).toBeLessThan(secondChunk?.painterOrder ?? 0)

      // Moving the second child first renumbers both subtrees.
      graph.insertChildAt(second.id, pageId, 0)
      index.renumber(graph, pageId)
      const front = index.getChunksForNode(second.id)[0]
      for (const chunk of index.getChunksDependingOnNode(first.id)) {
        expect(chunk.painterOrder).toBeGreaterThan(front?.painterOrder ?? Infinity)
      }

      graph.deleteNode(second.id)
      const gone = index.rebuildTop(graph, pageId, second.id)
      expect(gone.added).toEqual([])
      expect(index.hasTop(second.id)).toBe(false)
    } finally {
      index.dispose()
    }
  })

  test('rebuilds only the child subtree on the way to a layer added under a split frame', () => {
    const { graph, pageId } = graphWithNodes(40)
    const frame = graph.getChildren(pageId)[0]
    if (!frame) throw new Error('Expected a page child')
    const siblings = graph.getChildren(frame.id)
    const { index } = RenderChunkIndex.build(graph, pageId)
    try {
      const before = index.size()
      const untouched = index.getChunksForNode(siblings[5]?.id ?? '')[0]
      const added = graph.createNode('RECTANGLE', frame.id, { x: 500, y: 0, width: 10, height: 10 })
      const rebuilt = index.rebuildFrom(graph, pageId, added.id)
      expect(rebuilt?.removed).toEqual([])
      expect(rebuilt?.added.map((chunk) => chunk.nodeId)).toEqual([added.id])
      expect(index.size()).toBe(before + 1)
      // Untouched siblings keep their chunks and draw before the layer appended after them.
      expect(index.getChunksForNode(siblings[5]?.id ?? '')[0]).toBe(untouched)
      const last = index.getChunksForNode(siblings[39]?.id ?? '')[0]
      const addedChunk = index.getChunksForNode(added.id)[0]
      expect(addedChunk?.painterOrder).toBeGreaterThan(last?.painterOrder ?? Infinity)
      expect(
        index.search({ minX: 500, minY: 0, maxX: 510, maxY: 10 }).map((c) => c.nodeId)
      ).toContain(added.id)

      graph.deleteNode(added.id)
      const gone = index.rebuildFrom(graph, pageId, added.id)
      expect(gone).toBeNull()
      const fromParent = index.rebuildFrom(graph, pageId, frame.id)
      expect(fromParent?.removed.map((chunk) => chunk.nodeId)).toContain(added.id)
    } finally {
      index.dispose()
    }
  })

  test('numbers a split frame afresh once inserted layers exhaust the order between two', () => {
    const { graph, pageId } = graphWithNodes(40)
    const frame = graph.getChildren(pageId)[0]
    if (!frame) throw new Error('Expected the frame')
    const { index } = RenderChunkIndex.build(graph, pageId)
    // Each layer lands between the first and the one before it: the same gap, halved each time.
    for (let count = 0; count < 60; count++) {
      const added = graph.createNode('RECTANGLE', frame.id, { x: 5, y: 5, width: 2, height: 2 })
      graph.insertChildAt(added.id, frame.id, 1)
      const changed = index.rebuildFrom(graph, pageId, added.id)
      if (!changed) throw new Error('Expected a rebuild')
    }
    const orders = index
      .search({ minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9 })
      .filter((chunk) => chunk.nodeId !== frame.id)
      .map((chunk) => chunk.painterOrder)
    expect(orders.every((order, at) => at === 0 || order > (orders[at - 1] ?? -1))).toBe(true)
    expect(orders).toHaveLength(100)
    index.dispose()
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

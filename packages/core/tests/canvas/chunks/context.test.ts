import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { RenderChunkIndex } from '#core/canvas/renderer/chunks'

function defaultPage(graph: SceneGraph) {
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  return page
}

function addChildren(graph: SceneGraph, parentId: string, count: number) {
  for (let index = 0; index < count; index++) {
    graph.createNode('RECTANGLE', parentId, { x: index * 12, width: 10, height: 10 })
  }
}

describe('render chunk context', () => {
  test('preserves ancestor transform and clipping dependencies for split descendants', () => {
    const graph = new SceneGraph()
    const page = defaultPage(graph)
    const clippingParent = graph.createNode('FRAME', page.id, {
      x: 100,
      y: 200,
      width: 500,
      height: 500,
      rotation: 15,
      clipsContent: true
    })
    const oversized = graph.createNode('FRAME', clippingParent.id, { x: 20, y: 30 })
    addChildren(graph, oversized.id, 40)

    const { index } = RenderChunkIndex.build(graph, page.id)
    const child = graph.getChildren(oversized.id)[0]
    if (!child) throw new Error('Expected child')
    const chunk = index.getChunksForNode(child.id)[0]

    expect(chunk?.context.ancestorClipIds).toContain(clippingParent.id)
    expect(chunk?.context.parentTransform).not.toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    index.dispose()
  })

  test('keeps opacity and blend isolation subtrees atomic', () => {
    const graph = new SceneGraph()
    const page = defaultPage(graph)
    const frame = graph.createNode('FRAME', page.id, {
      opacity: 0.5,
      blendMode: 'MULTIPLY'
    })
    addChildren(graph, frame.id, 40)

    const { index, stats } = RenderChunkIndex.build(graph, page.id)
    const chunk = index.getChunksForNode(frame.id)[0]

    expect(chunk?.kind).toBe('subtree')
    expect(chunk?.interruptible).toBe(false)
    expect(chunk?.nodeCount).toBe(41)
    expect(stats.oversizedAtomicChunks).toBe(1)
    index.dispose()
  })

  test('keeps mask groups atomic', () => {
    const graph = new SceneGraph()
    const page = defaultPage(graph)
    const frame = graph.createNode('FRAME', page.id)
    const mask = graph.createNode('RECTANGLE', frame.id, { isMask: true })
    graph.updateNode(mask.id, { maskType: 'ALPHA' })
    addChildren(graph, frame.id, 40)

    const { index } = RenderChunkIndex.build(graph, page.id)
    const chunk = index.getChunksForNode(frame.id)[0]

    expect(chunk?.interruptible).toBe(false)
    expect(chunk?.kind).toBe('subtree')
    index.dispose()
  })
})

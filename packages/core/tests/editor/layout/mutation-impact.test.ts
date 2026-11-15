import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createLayoutRunner } from '#core/layout/mutations'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('mutation layout reconciliation', () => {
  test('reflows the previous parent after deletion', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const parent = graph.createNode('FRAME', page, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    const first = graph.createNode('RECTANGLE', parent.id, { width: 40, height: 20 })
    graph.createNode('RECTANGLE', parent.id, { width: 60, height: 20 })
    const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => graph)
    runLayoutForNode(parent.id)
    expect(parent.width).toBe(100)

    await runMutationWithLayout(() => graph.deleteNode(first.id), page)

    expect(parent.width).toBe(60)
  })

  test('reflows old and new parents after reparenting', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const left = graph.createNode('FRAME', page, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    const right = graph.createNode('FRAME', page, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    const child = graph.createNode('RECTANGLE', left.id, { width: 40, height: 20 })
    graph.createNode('RECTANGLE', left.id, { width: 30, height: 20 })
    const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => graph)
    runLayoutForNode(left.id)
    expect(left.width).toBe(70)

    await runMutationWithLayout(() => graph.reparentNode(child.id, right.id), page)

    expect(left.width).toBe(30)
    expect(right.width).toBe(40)
  })

  test('keeps a hugging parent at its size when its last child moves out', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const hug = {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    } as const
    const left = graph.createNode('FRAME', page, hug)
    const right = graph.createNode('FRAME', page, hug)
    const child = graph.createNode('RECTANGLE', left.id, { width: 40, height: 20 })
    const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => graph)
    runLayoutForNode(left.id)

    await runMutationWithLayout(() => graph.reparentNode(child.id, right.id), page)

    // Figma keeps a frame with nothing left to hug at the size it hugged to.
    expect([left.width, left.height]).toEqual([40, 20])
    expect([right.width, right.height]).toEqual([40, 20])
  })
})

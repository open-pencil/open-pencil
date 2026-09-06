import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createLayoutRunner } from '#core/editor/layout-runner'

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
    const { runLayoutForNode, runMutationWithLayout } = createLayoutRunner(() => graph)
    runLayoutForNode(left.id)

    await runMutationWithLayout(() => graph.reparentNode(child.id, right.id), page)

    expect(left.width).toBe(0)
    expect(right.width).toBe(40)
  })
})

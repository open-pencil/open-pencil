import { describe, expect, test } from 'bun:test'

import { compactDesign } from '#design-json/compact/index'
import type { CompactNode } from '#design-json/compact/types'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createCommentThread, writeComments } from '@open-pencil/scene-graph/comments'

const AUTHOR = { name: 'Ana' }
const NOW = '2026-11-21T00:00:00.000Z'

/** A card with a box and a label drawn loose inside it, and a group of two dots beside it. */
function design() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const card = graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 120 })
  graph.createNode('RECTANGLE', card.id, { name: 'Box', x: 10, y: 10, width: 80, height: 80 })
  graph.createNode('TEXT', card.id, { name: 'Label', x: 100, y: 10, width: 80, height: 20 })
  const dots = graph.createNode('GROUP', pageId, { name: 'Dots', x: 300, width: 60, height: 20 })
  graph.createNode('ELLIPSE', dots.id, { name: 'Dot', width: 20, height: 20 })
  graph.createNode('ELLIPSE', dots.id, { name: 'Dot', x: 40, width: 20, height: 20 })
  return { graph, pageId, card, dots }
}

function comment(graph: SceneGraph, pageId: string, x: number, y: number, node?: SceneNode) {
  return createCommentThread(graph, {
    pageId,
    at: { x, y },
    node,
    author: AUTHOR,
    text: `${x},${y}`,
    now: NOW
  })
}

function commentsOn(nodes: readonly CompactNode[]): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  const visit = (node: CompactNode) => {
    if (node.comments) found[node.name] = node.comments.map((entry) => entry.text)
    node.children?.forEach(visit)
  }
  nodes.forEach(visit)
  return found
}

describe('compact comments', () => {
  test('a comment goes to the deepest layer under it, else to the one that holds it', () => {
    const { graph, pageId, card, dots } = design()
    writeComments(graph, [
      comment(graph, pageId, 20, 20, card),
      comment(graph, pageId, 120, 15, card),
      comment(graph, pageId, 150, 100, card),
      comment(graph, pageId, 310, 10, dots)
    ])
    const { roots } = compactDesign(graph, [card.id, dots.id])
    expect(commentsOn(roots)).toEqual({
      Box: ['20,20'],
      Label: ['120,15'],
      // Over the card but none of its layers.
      Card: ['150,100'],
      // Over a dot, but a group keeps the comments on its layers.
      Dots: ['310,10']
    })
  })

  test('a pin over no layer is loose, at its place on the canvas; deleted ones are left out', () => {
    const { graph, pageId, card } = design()
    const outside = comment(graph, pageId, 260, 200, card)
    const inside = comment(graph, pageId, 150, 100, card)
    const deleted = { ...comment(graph, pageId, 20, 20, card), deleted: true }
    writeComments(graph, [outside, inside, deleted])
    const output = compactDesign(graph, [card.id])
    expect(commentsOn(output.roots)).toEqual({ Card: ['150,100'] })
    // A comment on a layer is at its place in the layer's box.
    expect(output.roots[0].comments).toEqual([
      { id: inside.id, x: 150, y: 100, author: 'Ana', text: '150,100' }
    ])
    expect(output.comments).toEqual([
      { id: outside.id, x: 260, y: 200, author: 'Ana', text: '260,200' }
    ])
  })

  test("a comment inside a nested layer is placed in that layer's box", () => {
    const { graph, pageId, card } = design()
    writeComments(graph, [comment(graph, pageId, 20, 30, card)])
    const box = compactDesign(graph, [card.id]).roots[0].children?.find(
      (node) => node.name === 'Box'
    )
    expect(box?.comments?.map(({ x, y }) => [x, y])).toEqual([[10, 20]])
  })
})

import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { previewFocus } from '@/app/ai/preview/canvas'
import { MAX_OUTLINE } from '@/app/presence/schema'

import { expectDefined } from '#tests/helpers/assert'

function page(graph: SceneGraph) {
  return expectDefined(graph.getPages()[0], 'page').id
}

describe('streamed JSX focus', () => {
  test('points at the element that appeared last and outlines what the JSX builds', () => {
    const graph = new SceneGraph()
    const card = graph.createNode('FRAME', page(graph), { x: 100, y: 50, width: 300, height: 200 })
    graph.createNode('TEXT', card.id, { x: 16, y: 16, width: 100, height: 20 })
    const footer = graph.createNode('FRAME', card.id, { x: 16, y: 120, width: 268, height: 60 })
    const button = graph.createNode('RECTANGLE', footer.id, { x: 8, y: 8, width: 80, height: 32 })

    const focus = expectDefined(previewFocus({ graph, renderedIds: [card.id] }), 'focus')
    // The source's last element: the button, the last child of the card's last child. The
    // cursor sits at its trailing corner, where content grows.
    expect(focus.cursor).toEqual({ x: 204, y: 210 })
    expect(focus.outline).toEqual([
      { x: 100, y: 50, width: 300, height: 200 },
      { x: 124, y: 178, width: 80, height: 32 }
    ])
    expect(button.id).toBeString()
  })

  test('a lone element is both the cursor and the outline, and outlines stay bounded', () => {
    const graph = new SceneGraph()
    const roots = Array.from({ length: MAX_OUTLINE + 4 }, (_, index) =>
      graph.createNode('RECTANGLE', page(graph), { x: index * 10, y: 0, width: 8, height: 8 })
    )
    const focus = expectDefined(
      previewFocus({ graph, renderedIds: roots.map((root) => root.id) }),
      'focus'
    )
    expect(focus.cursor).toEqual({ x: (MAX_OUTLINE + 3) * 10 + 8, y: 8 })
    expect(focus.outline).toHaveLength(MAX_OUTLINE)
  })

  test('nothing rendered yet has no focus', () => {
    expect(previewFocus({ graph: new SceneGraph(), renderedIds: [] })).toBeNull()
  })
})

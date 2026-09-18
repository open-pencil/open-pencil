import { expect, test } from 'bun:test'

import {
  findNodesByName,
  focusNodes,
  focusNodesByName,
  type FocusStore
} from '@/app/editor/selection/focus'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function harness() {
  const graph = makeSceneGraph()
  const pageId = firstPageId(graph)
  const selected: string[][] = []
  let zooms = 0
  const store: FocusStore = {
    graph,
    state: { currentPageId: pageId },
    select: (ids) => void selected.push(ids),
    zoomToSelection: () => void zooms++
  }
  return {
    graph,
    pageId,
    store,
    selected,
    get zooms() {
      return zooms
    }
  }
}

test('finds every node with the exact name and nothing else', () => {
  const { graph, pageId } = harness()
  const frame = graph.createNode('FRAME', pageId, { name: 'Card' })
  const exact = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })
  graph.createNode('RECTANGLE', frame.id, { name: 'Button/Primary' })
  graph.createNode('TEXT', frame.id, { name: 'button' })

  expect(findNodesByName(graph, pageId, 'Button')).toEqual([exact.id])
  expect(findNodesByName(graph, pageId, 'Missing')).toEqual([])
})

test('walks nested groups rather than only the first level', () => {
  const { graph, pageId } = harness()
  const outer = graph.createNode('FRAME', pageId, { name: 'Outer' })
  const inner = graph.createNode('GROUP', outer.id, { name: 'Inner' })
  const leaf = graph.createNode('RECTANGLE', inner.id, { name: 'Deep' })

  expect(findNodesByName(graph, pageId, 'Deep')).toEqual([leaf.id])
})

test('focuses every match by name and zooms once', () => {
  const { graph, pageId, store, selected } = harness()
  const frame = graph.createNode('FRAME', pageId, { name: 'Card' })
  const first = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })
  const second = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })

  expect(focusNodesByName(store, 'Button')).toBe(true)
  expect(selected).toEqual([[first.id, second.id]])
})

test('does nothing for a name the page does not carry', () => {
  const { store, selected } = harness()

  expect(focusNodesByName(store, 'Missing')).toBe(false)
  expect(selected).toEqual([])
})

test('ignores ids that are no longer in the document', () => {
  const { graph, pageId, store, selected } = harness()
  const stale = graph.createNode('RECTANGLE', pageId, { name: 'Gone' })
  const live = graph.createNode('RECTANGLE', pageId, { name: 'Here' })
  graph.deleteNode(stale.id)

  // A share or awareness reference can outlive the node it points at.
  expect(focusNodes(store, [stale.id])).toBe(false)
  expect(selected).toEqual([])
  expect(focusNodes(store, [stale.id, live.id])).toBe(true)
  expect(selected).toEqual([[live.id]])
})

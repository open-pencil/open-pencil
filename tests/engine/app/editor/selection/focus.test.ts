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
  const prepared: string[] = []
  let zooms = 0
  let switches = 0
  const store: FocusStore = {
    graph,
    state: { currentPageId: pageId },
    select: (ids) => void selected.push(ids),
    zoomToSelection: () => void zooms++,
    loadPageNodes: async (id) => void prepared.push(id),
    switchPage: async (id) => {
      switches++
      store.state.currentPageId = id
    },
    pageSwitchCount: () => switches
  }
  return {
    graph,
    pageId,
    store,
    selected,
    prepared,
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

test('focuses every match by name and zooms once', async () => {
  const { graph, pageId, store, selected } = harness()
  const frame = graph.createNode('FRAME', pageId, { name: 'Card' })
  const first = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })
  const second = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })

  expect(await focusNodesByName(store, 'Button')).toBe('found')
  expect(selected).toEqual([[first.id, second.id]])
})

test('prefers the current page and otherwise switches to the first page carrying the name', async () => {
  const { graph, pageId, store, selected, prepared } = harness()
  const second = graph.addPage('Components')
  const third = graph.addPage('More')
  const here = graph.createNode('RECTANGLE', pageId, { name: 'Shared' })
  graph.createNode('RECTANGLE', second.id, { name: 'Shared' })
  const button = graph.createNode('COMPONENT', third.id, { name: 'Button' })

  expect(await focusNodesByName(store, 'Shared')).toBe('found')
  expect(selected).toEqual([[here.id]])
  expect(prepared).toEqual([])

  expect(await focusNodesByName(store, 'Button')).toBe('found')
  expect(prepared).not.toContain(pageId)
  expect(prepared.slice(-2)).toEqual([second.id, third.id])
  expect(store.state.currentPageId).toBe(third.id)
  expect(selected.at(-1)).toEqual([button.id])
})

test('yields to a page switch the user starts while other pages load', async () => {
  const { graph, pageId, store, selected } = harness()
  const other = graph.addPage('Other')
  const mine = graph.addPage('Mine')
  graph.createNode('COMPONENT', other.id, { name: 'Button' })
  store.loadPageNodes = async () => {
    await store.switchPage(mine.id)
  }

  expect(await focusNodesByName(store, 'Button')).toBe('superseded')
  expect(store.state.currentPageId).toBe(mine.id)
  expect(selected).toEqual([])
  expect(pageId).not.toBe(mine.id)
})

test('does not focus a page while another switch is still pending', async () => {
  const { graph, store, selected } = harness()
  const other = graph.addPage('Other')
  graph.createNode('COMPONENT', other.id, { name: 'Button' })
  // The user's switch starts during the search's own and has not committed yet.
  const { switchPage, pageSwitchCount } = store
  let pending = 0
  store.pageSwitchCount = () => pageSwitchCount() + pending
  store.switchPage = async (id) => {
    await switchPage(id)
    pending++
  }

  expect(await focusNodesByName(store, 'Button')).toBe('superseded')
  expect(store.state.currentPageId).toBe(other.id)
  expect(selected).toEqual([])
})

test('does nothing for a name no page carries', async () => {
  const { pageId, store, selected } = harness()

  expect(await focusNodesByName(store, 'Missing')).toBe('missing')
  expect(selected).toEqual([])
  expect(store.state.currentPageId).toBe(pageId)
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

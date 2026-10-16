import { expect, test } from 'bun:test'

import { focusLinkedNode, type LinkedNodeStore } from '@/app/document/io/linked-node'
import { rememberLoadedRevision } from '@/app/document/io/revision'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function harness() {
  const graph = makeSceneGraph()
  const pageId = firstPageId(graph)
  const node = graph.createNode('COMPONENT', pageId)
  node.source.id = '42:9'
  rememberLoadedRevision(graph, new File(['abc'], 'library.fig'))
  const selection: string[][] = []
  const store: LinkedNodeStore = {
    graph,
    state: { currentPageId: pageId },
    getSourceIdentity: () => ({ path: '/repo/library.fig' }),
    hasUnsavedChanges: () => false,
    getStorageBinding: () => null,
    select: (ids) => {
      selection.push(ids)
    },
    zoomToSelection: () => undefined,
    loadPageNodes: async () => undefined,
    switchPage: async () => undefined,
    pageSwitchCount: () => 0
  }
  const target = { id: '42:9', revision: SHA256_ABC, file: '/repo/library.fig' }
  return { graph, node, selection, store, target }
}

test('a pinned source selects the persisted identity only in its intended active document', async () => {
  const h = harness()
  expect(await focusLinkedNode(h.store, h.target, () => true)).toBe('found')
  expect(h.selection).toEqual([[h.node.id]])
  h.selection.length = 0
  expect(await focusLinkedNode(h.store, h.target, () => false)).toBe('superseded')
  expect(h.selection).toEqual([])
})

test('an edit while lazy pages load invalidates pinned navigation before selection', async () => {
  const h = harness()
  let dirty = false
  h.store.hasUnsavedChanges = () => dirty
  h.store.loadPageNodes = async () => {
    dirty = true
  }
  expect(await focusLinkedNode(h.store, h.target, () => true)).toBe('stale')
  expect(h.selection).toEqual([])
})

import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { followAgentActivity } from '@/app/automation/mcp/follow-agent'
import { createEditorStore } from '@/app/editor/session'

function targetFor(store: ReturnType<typeof createEditorStore>) {
  const page = store.graph.getNode(store.state.currentPageId)
  if (!page || page.type !== 'CANVAS') throw new Error('Missing test page')
  return {
    store,
    documentId: 'test-document',
    documentName: 'Test document',
    pageId: page.id,
    pageName: page.name
  }
}

test('follows an MCP export to the requested nodes', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const first = graph.createNode('RECTANGLE', page.id, { x: 0, y: 0, width: 100, height: 100 })
  const second = graph.createNode('RECTANGLE', page.id, {
    x: 1600,
    y: 900,
    width: 100,
    height: 100
  })
  const store = createEditorStore(graph)
  store.setViewportSize(1000, 800)

  await followAgentActivity(targetFor(store), 'export_image', { ids: [first.id, second.id] }, {})

  expect([...store.state.selectedIds]).toEqual([first.id, second.id])
  expect(store.state.zoom).toBeLessThan(1)
})

test('follows a requested page before fitting it in the canvas', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  const secondPage = graph.addPage('Second page')
  const state = { currentPageId: firstPage.id, selectedIds: new Set<string>() }
  const calls: string[] = []
  const store = {
    graph,
    state,
    switchPage: async (pageId: string) => {
      calls.push(pageId)
      state.currentPageId = pageId
    },
    clearSelection: () => state.selectedIds.clear(),
    zoomToFit: () => calls.push('fit')
  }

  await followAgentActivity(
    {
      store: store as never,
      documentId: 'test-document',
      documentName: 'Test document',
      pageId: secondPage.id,
      pageName: secondPage.name
    },
    'get_page_tree',
    {},
    {}
  )

  expect(calls).toEqual([secondPage.id, 'fit'])
  expect(state.currentPageId).toBe(secondPage.id)
  expect(state.selectedIds.size).toBe(0)
})

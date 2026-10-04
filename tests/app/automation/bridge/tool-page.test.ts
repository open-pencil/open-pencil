import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { BUILTIN_IO_FORMATS, IORegistry, parseFigFile } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

const { handleTargetCommand } = createAutomationCommandHandlers(makeFigmaFromStore)
let stores: EditorStore[] = []

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window.
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
})

afterEach(() => {
  for (const store of stores) store.dispose()
  stores = []
  Reflect.deleteProperty(globalThis, 'window')
})

/** A `.fig` opened like the app does: only the first page has its layers. */
async function storeWithUnshownPage(): Promise<{ store: EditorStore; pageId: string }> {
  const source = new SceneGraph()
  source.createNode('FRAME', source.getPages()[0].id, { name: 'First frame' })
  const second = source.addPage('Second')
  source.createNode('FRAME', second.id, { name: 'Second frame', width: 70, height: 35 })
  const written = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', source)
  const bytes = written.data as Uint8Array
  const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
  const store = createEditorStore(graph)
  stores.push(store)
  const page = graph.getPages().find((p) => p.name === 'Second')
  if (!page) throw new Error('Missing second page')
  expect(graph.getChildren(page.id)).toHaveLength(0)
  return { store, pageId: page.id }
}

function target(store: EditorStore, pageId: string): AutomationTarget {
  return {
    store,
    documentId: 'tab-1',
    documentName: 'Document',
    pageId,
    pageName: store.graph.getNode(pageId)?.name ?? ''
  }
}

describe('automation tools on a page that has not been shown', () => {
  test('find_nodes sees the layers of the target page', async () => {
    const { store, pageId } = await storeWithUnshownPage()
    const shown = store.state.currentPageId

    const response = (await handleTargetCommand(target(store, pageId), 'tool', {
      name: 'find_nodes',
      args: { name: 'Second frame' }
    })) as { result: { count: number } }

    expect(response.result.count).toBe(1)
    expect(store.state.currentPageId).toBe(shown)
  })

  test('a shape created there joins the existing layers', async () => {
    const { store, pageId } = await storeWithUnshownPage()

    await handleTargetCommand(target(store, pageId), 'tool', {
      name: 'create_shape',
      args: { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10, name: 'Added' }
    })

    expect(store.graph.getChildren(pageId).map((node) => node.name)).toEqual([
      'Second frame',
      'Added'
    ])
  })

  test('a tool measures the target page after its layout runs', async () => {
    const store = createEditorStore()
    stores.push(store)
    const other = store.graph.addPage('Other').id
    // Not laid out yet: the row hugs one 80 px child but still says 10 px.
    const row = store.graph.createNode('FRAME', other, {
      width: 10,
      height: 20,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    store.graph.createNode('FRAME', row.id, { width: 80, height: 20 })

    const response = (await handleTargetCommand(target(store, other), 'tool', {
      name: 'get_node',
      args: { id: row.id }
    })) as { result: { width: number } }

    expect(response.result.width).toBe(80)
  })
})

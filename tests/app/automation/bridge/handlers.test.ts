import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { toRaw } from 'vue'

import * as layoutModule from '@open-pencil/core/layout'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { automationFiles } from '@/app/automation/bridge/server'
import { recentDocuments } from '@/app/recent-files'
import { recentFilesLimit } from '@/app/recent-files/preferences'
import { appPreferences } from '@/app/settings/preferences/store'
import { createTab, getActiveStore, getActiveTabId, getTabById, getTabsSnapshot } from '@/app/tabs'

import { asDouble } from '#tests/helpers/doubles'
import { testPath } from '#tests/helpers/paths'

function setupGlobals() {
  globalThis.window = asDouble<Window & typeof globalThis>({
    innerWidth: 1024,
    innerHeight: 768,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    },
    cancelAnimationFrame: vi.fn(),
    openPencil: {},
    location: { href: 'http://localhost/' } as Location,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  globalThis.document = asDouble<Document>({
    fonts: { add: vi.fn(), ready: Promise.resolve() }
  })
  globalThis.requestAnimationFrame = window.requestAnimationFrame
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame
}

const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)

// Page switches wait for the canvas to present; nothing renders here, so acknowledge it.
async function settle<T>(pending: Promise<T>): Promise<T> {
  const idle = Symbol('idle')
  for (const tab of getTabsSnapshot()) {
    if (tab.store.state.preparation?.phase !== 'preparing-render') continue
    tab.store.preparationController.acknowledgePresentation(tab.store.state.sceneVersion)
  }
  const result = await Promise.race([
    pending,
    new Promise<typeof idle>((resolve) => {
      setTimeout(() => resolve(idle), 0)
    })
  ])
  return result === idle ? settle(pending) : (result as T)
}

function request(command: string, args: Record<string, unknown> = {}) {
  return handleRequest(getActiveStore(), command, args) as Promise<{
    ok: boolean
    result: Record<string, unknown>
    target?: { documentId: string; pageId: string }
  }>
}

beforeEach(() => {
  setupGlobals()
  vi.spyOn(layoutModule, 'computeAllLayouts').mockReturnValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
  Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
})

describe('activate_document', () => {
  test('brings a background tab to the front on the requested page', async () => {
    const background = createTab()
    const pageId = background.store.graph.addPage('Second').id
    createTab()
    expect(getActiveTabId()).not.toBe(background.id)

    const response = await settle(
      request('activate_document', { document_id: background.id, page_id: pageId })
    )

    expect(response.result).toEqual({ activated: true })
    expect(response.target).toMatchObject({ documentId: background.id, pageId })
    expect(getActiveTabId()).toBe(background.id)
    expect(background.store.state.currentPageId).toBe(pageId)
  })

  test('rejects an unknown document', async () => {
    createTab()
    await expect(request('activate_document', { document_id: 'missing' })).rejects.toThrow(
      'Document "missing" not found'
    )
  })
})

describe('undo and redo', () => {
  test('step through automation changes and report their labels', async () => {
    const tab = createTab()
    const store = tab.store
    const node = store.createShape('RECTANGLE', 0, 0, 100, 100)
    await request('tool', {
      document_id: tab.id,
      name: 'set_opacity',
      args: { id: node, value: 0.5 }
    })

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toEqual({ applied: true, label: 'Agent: set_opacity' })
    expect(store.graph.getNode(node)?.opacity).toBe(1)

    const redone = await request('redo', { document_id: tab.id })
    expect(redone.result).toEqual({ applied: true, label: 'Agent: set_opacity' })
    expect(store.graph.getNode(node)?.opacity).toBe(0.5)
  })

  test('refuse to undo or redo a change made in the editor', async () => {
    const tab = createTab()
    const store = tab.store
    const node = store.createShape('RECTANGLE', 0, 0, 100, 100)
    store.updateNodeWithUndo(node, { opacity: 0.5 }, 'Set opacity')

    await expect(request('undo', { document_id: tab.id })).rejects.toThrow(
      'The last change ("Set opacity") was made in the editor'
    )
    expect(store.graph.getNode(node)?.opacity).toBe(0.5)

    store.undoAction()
    await expect(request('redo', { document_id: tab.id })).rejects.toThrow(
      'The last undone change ("Set opacity") was made in the editor'
    )
    expect(store.graph.getNode(node)?.opacity).toBe(1)
  })

  test('report nothing to redo on a fresh history', async () => {
    const tab = createTab()
    const response = await request('redo', { document_id: tab.id })
    expect(response.result).toEqual({ applied: false, label: null })
  })

  test('undo reverts a layer an automation tool created', async () => {
    const tab = createTab()
    const created = await request('tool', {
      document_id: tab.id,
      name: 'create_shape',
      args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 40, name: 'Card' }
    })
    const id = String(created.result.id)
    expect(tab.store.graph.getNode(id)).toBeDefined()

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toMatchObject({ applied: true, label: 'Agent: create_shape' })
    expect(tab.store.graph.getNode(id)).toBeUndefined()
  })

  test('undo and redo of a deletion leave the layers it did not touch alone', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const kept = tab.store.createShape('RECTANGLE', 0, 0, 40, 40)
    const deleted = tab.store.createShape('RECTANGLE', 60, 0, 40, 40)
    const keptNode = graph.getNode(kept)
    const pageId = tab.store.state.currentPageId
    const order = [...(graph.getNode(pageId)?.childIds ?? [])]
    await request('tool', { document_id: tab.id, name: 'delete_node', args: { id: deleted } })

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(deleted)?.x).toBe(60)
    expect(graph.getNode(pageId)?.childIds).toEqual(order)
    expect(graph.getNode(kept)).toBe(keptNode)

    await request('redo', { document_id: tab.id })
    expect(graph.getNode(deleted)).toBeUndefined()
    expect(graph.getNode(kept)).toBe(keptNode)
  })

  test('undo reverts a render into a frame on another page', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const frame = graph.createNode('FRAME', otherPage.id, { width: 200, height: 200 })
    const rendered = await request('tool', {
      document_id: tab.id,
      name: 'render',
      args: {
        parent_id: frame.id,
        jsx: '<Frame name="Rendered" w={40} h={40} />'
      }
    })
    const id = String(rendered.result.id)
    expect(graph.getNode(id)?.parentId).toBe(frame.id)

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(id)).toBeUndefined()
    expect(graph.getNode(frame.id)?.childIds).toEqual([])
  })

  test('undo reverts a render that replaces a layer on another page', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const frame = graph.createNode('FRAME', otherPage.id, { width: 200, height: 200 })
    const placeholder = graph.createNode('RECTANGLE', frame.id, { width: 40, height: 40 })
    // replace_id decides where the layer goes, so its page records the change.
    const rendered = await request('tool', {
      document_id: tab.id,
      name: 'render',
      args: {
        jsx: '<Frame name="Rendered" w={40} h={40} />',
        replace_id: placeholder.id,
        parent_id: tab.store.state.currentPageId
      }
    })
    const id = String(rendered.result.id)
    expect(graph.getNode(id)?.parentId).toBe(frame.id)

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(id)).toBeUndefined()
    expect(graph.getNode(frame.id)?.childIds).toEqual([placeholder.id])
  })

  test('undo reverts a script’s edits to other pages, pages, and variables', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const otherPage = graph.addPage('Other')
    const card = graph.createNode('FRAME', otherPage.id, { name: 'Card', width: 200, height: 200 })
    const pages = graph.getPages().map((page) => page.id)
    await request('eval', {
      document_id: tab.id,
      code: `
        const other = figma.root.children.find((page) => page.name === 'Other')
        other.findOne((node) => node.name === 'Card').name = 'Renamed'
        other.name = 'Renamed page'
        figma.createPage().name = 'Added'
        const colors = figma.variables.createVariableCollection('Colors')
        figma.variables.createVariable('Brand', colors, 'COLOR')
      `
    })
    expect(graph.getNode(card.id)?.name).toBe('Renamed')
    expect(graph.variables.size).toBe(1)

    const undone = await request('undo', { document_id: tab.id })
    expect(undone.result).toMatchObject({ applied: true, label: 'Agent: eval' })
    expect(graph.getNode(card.id)?.name).toBe('Card')
    expect(graph.getNode(otherPage.id)?.name).toBe('Other')
    expect(graph.getPages().map((page) => page.id)).toEqual(pages)
    expect(graph.variables.size).toBe(0)
    expect(graph.variableCollections.size).toBe(0)

    await request('redo', { document_id: tab.id })
    expect(graph.getNode(card.id)?.name).toBe('Renamed')
    expect(graph.getPages().map((page) => page.name)).toEqual(['Page 1', 'Renamed page', 'Added'])
    expect(graph.variables.size).toBe(1)
  })

  test('a read-only eval leaves the history unchanged', async () => {
    const tab = createTab()
    await request('eval', { document_id: tab.id, code: 'return figma.currentPage.name' })
    expect(tab.store.undo.canUndo).toBe(false)
  })
})

// The stdio MCP server sends render JSX as written; these are what #830 lost on that path.
describe('render JSX', () => {
  function render(tabId: string, args: Record<string, unknown>) {
    return request('tool', { document_id: tabId, name: 'render', args })
  }

  test('binds a design variable', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    graph.addCollection({
      id: 'brand',
      name: 'Brand',
      modes: [{ modeId: 'default', name: 'Default' }],
      defaultModeId: 'default',
      variableIds: []
    })
    graph.addVariable({
      id: 'var-primary',
      name: 'Brand/primary',
      type: 'COLOR',
      collectionId: 'brand',
      valuesByMode: { default: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    const rendered = await render(tab.id, {
      jsx: "<Frame w={100} h={100} fill={designVar('Brand/primary')} />"
    })
    const node = graph.getNode(String(rendered.result.id))
    expect(node?.boundVariables['fills/0/color']).toBe('var-primary')
  })

  test('replaces a placeholder in its place', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const placeholder = tab.store.createShape('RECTANGLE', 60, 30, 40, 40)
    const rendered = await render(tab.id, {
      jsx: '<Frame name="Card" w={40} h={40} />',
      replace_id: placeholder
    })
    const node = graph.getNode(String(rendered.result.id))
    expect(graph.getNode(placeholder)).toBeUndefined()
    expect([node?.x, node?.y]).toEqual([60, 30])
  })

  test('inserts at the requested index', async () => {
    const tab = createTab()
    const graph = tab.store.graph
    const frame = graph.createNode('FRAME', tab.store.state.currentPageId, {
      width: 200,
      height: 200
    })
    graph.createNode('RECTANGLE', frame.id, { name: 'First' })
    graph.createNode('RECTANGLE', frame.id, { name: 'Second' })
    const rendered = await render(tab.id, {
      jsx: '<Frame name="Inserted" w={20} h={20} />',
      parent_id: frame.id,
      insert_index: 1
    })
    expect(graph.getNode(frame.id)?.childIds[1]).toBe(String(rendered.result.id))
  })
})

describe('close_file and save_file never prompt', () => {
  function dirtyTab() {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    expect(tab.store.hasUnsavedChanges()).toBe(true)
    return tab
  }

  test('closing unsaved changes fails unless the caller chooses', async () => {
    const tab = dirtyTab()
    await expect(request('close_file', { document_id: tab.id })).rejects.toThrow(
      'has unsaved changes'
    )
    expect(getTabById(tab.id)).toBeDefined()

    const closed = await request('close_file', { document_id: tab.id, unsaved: 'discard' })
    expect(closed.result).toEqual({ closed: true })
    expect(getTabById(tab.id)).toBeUndefined()
  })

  test('saving a document that has no file asks for a path instead of a dialog', async () => {
    const tab = dirtyTab()
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow(
      'has not been saved to a file yet'
    )
    await expect(request('close_file', { document_id: tab.id, unsaved: 'save' })).rejects.toThrow(
      'has not been saved to a file yet'
    )
    expect(getTabById(tab.id)).toBeDefined()
  })

  test('a failed save to a path keeps the document source it had', async () => {
    const tab = dirtyTab()
    // Outside Tauri a path cannot be written, so the save fails.
    await expect(
      request('save_file', { document_id: tab.id, path: '/tmp/never-written.fig' })
    ).rejects.toThrow('Could not save')
    expect(tab.store.state.documentName).toBe('Untitled')
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasWritableSource()).toBe(false)
  })
})

describe('file paths in a browser go through the MCP server', () => {
  const { handleRequest: handleThroughServer } = createAutomationCommandHandlers(
    makeFigmaFromStore,
    automationFiles('ws://mcp.test', 'token')
  )
  const requestThroughServer = (command: string, args: Record<string, unknown>) =>
    handleThroughServer(getActiveStore(), command, args)

  function dirtyTab() {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    return tab
  }

  test('saving to a path hands the server a copy, saved as a download is', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await requestThroughServer('save_file', { document_id: tab.id, path: '/root/copy.fig' })

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('http://mcp.test/files//root/copy.fig')
    expect(init?.method).toBe('PUT')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token')
    expect(tab.store.hasUnsavedChanges()).toBe(false)
    // Where the document saves next does not change.
    expect(tab.store.hasWritableSource()).toBe(false)
  })

  test('a copy the server refuses leaves the changes unsaved', async () => {
    const tab = dirtyTab()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('outside', { status: 400 }))
    await expect(
      requestThroughServer('save_file', { document_id: tab.id, path: '/elsewhere/copy.fig' })
    ).rejects.toThrow('Could not write /elsewhere/copy.fig: outside')
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('opening a path fetches it from the server with the token', async () => {
    const bytes = new Uint8Array(await Bun.file(testPath('fixtures', 'slots.fig')).arrayBuffer())
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    await settle(requestThroughServer('open_file', { path: '/root/my #1 slots.fig' }))

    const [url, init] = fetch.mock.calls[0]
    // A reserved character stays in the path rather than starting a fragment.
    expect(String(url)).toBe('http://mcp.test/files//root/my%20%231%20slots.fig')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token')
    expect(getActiveStore().state.documentName).toBe('my #1 slots')
  })
})

describe('list_recent_files', () => {
  let previousPreferences: typeof appPreferences.value

  beforeEach(() => {
    previousPreferences = structuredClone(toRaw(appPreferences.value))
  })

  afterEach(() => {
    recentDocuments.value = []
    appPreferences.value = previousPreferences
  })

  test('lists local files newest first within the recent files limit', async () => {
    const updatedAt = '2026-01-01T00:00:00.000Z'
    recentDocuments.value = [
      { id: 'local:/a.fig', kind: 'local', path: '/a.fig', name: 'a.fig', updatedAt },
      {
        id: 'storage:s3:doc',
        kind: 'storage',
        providerId: 's3',
        documentId: 'doc',
        name: 'Stored',
        updatedAt
      },
      { id: 'local:/b.fig', kind: 'local', path: '/b.fig', name: 'b.fig', updatedAt },
      { id: 'local:/c.fig', kind: 'local', path: '/c.fig', name: 'c.fig', updatedAt }
    ]
    recentFilesLimit.value = 3

    const response = await request('list_recent_files')

    expect(response.result).toEqual({
      files: [
        { path: '/a.fig', name: 'a.fig', updated_at: updatedAt },
        { path: '/b.fig', name: 'b.fig', updated_at: updatedAt }
      ]
    })
  })
})

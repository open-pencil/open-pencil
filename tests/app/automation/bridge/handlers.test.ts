import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import * as layoutModule from '@open-pencil/core/layout'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { createTab, getActiveStore, getActiveTabId, getTabById, getTabsSnapshot } from '@/app/tabs'

function setupGlobals() {
  globalThis.window = {
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
  } as Window & typeof globalThis
  globalThis.document = {
    fonts: { add: vi.fn(), ready: Promise.resolve() }
  } as Document
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
        tree: { type: 'frame', props: { name: 'Rendered', w: 40, h: 40 }, children: [] }
      }
    })
    const id = String(rendered.result.id)
    expect(graph.getNode(id)?.parentId).toBe(frame.id)

    await request('undo', { document_id: tab.id })
    expect(graph.getNode(id)).toBeUndefined()
    expect(graph.getNode(frame.id)?.childIds).toEqual([])
  })

  test('a read-only eval leaves the history unchanged', async () => {
    const tab = createTab()
    await request('eval', { document_id: tab.id, code: 'return figma.currentPage.name' })
    expect(tab.store.undo.canUndo).toBe(false)
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

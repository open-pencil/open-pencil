import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { toRaw } from 'vue'

import * as layoutModule from '@open-pencil/core/layout'
import { asDouble } from '@open-pencil/test-support/doubles'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { automationFiles } from '@/app/automation/bridge/server'
import * as saveTargets from '@/app/document/io/save/targets'
import { recentDocuments } from '@/app/recent-files'
import { recentFilesLimit } from '@/app/recent-files/preferences'
import { appPreferences } from '@/app/settings/preferences/store'
import { createTab, getActiveStore, getActiveTabId, getTabById, getTabsSnapshot } from '@/app/tabs'

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
    tab.store.preparationController.acknowledgePresentation(tab.store.state)
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

  function recordNativeFs(): string[] {
    const commands: string[] = []
    Object.assign(window, {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args?: { path?: string }) => {
          commands.push(cmd)
          if (cmd !== 'plugin:path|dirname') return null
          const path = args?.path ?? ''
          const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
          return slash > 0 ? path.slice(0, slash) : path
        }
      }
    })
    return commands
  }

  function fsWrites(commands: string[]): string[] {
    return commands.filter((cmd) => cmd === 'plugin:fs|mkdir' || cmd === 'plugin:fs|write_file')
  }

  test('a native save to a non-.fig path does not create a directory or write the file', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    await expect(
      request('save_file', { document_id: tab.id, path: '/tmp/nested/never-written.pen' })
    ).rejects.toThrow('"/tmp/nested/never-written.fig"')
    expect(fsWrites(commands)).toEqual([])
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('a native save to a .fig path creates the directory and writes the file', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    await request('save_file', { document_id: tab.id, path: '/tmp/nested/saved.fig' })
    expect(fsWrites(commands)).toEqual(['plugin:fs|mkdir', 'plugin:fs|write_file'])
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  test('saving over an existing .pen file writes nothing', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    tab.store.setPlannedFilePath('/tmp/notes.pen')
    expect(tab.store.hasWritableSource()).toBe(true)
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow('"/tmp/notes.fig"')
    expect(fsWrites(commands)).toEqual([])
    expect(tab.store.getDocumentFilePath()).toBe('/tmp/notes.pen')
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with save over an extensionless file writes nothing and keeps the tab', async () => {
    const commands = recordNativeFs()
    const tab = dirtyTab()
    tab.store.setPlannedFilePath('/tmp/notes')
    await expect(request('close_file', { document_id: tab.id, unsaved: 'save' })).rejects.toThrow(
      '"/tmp/notes.fig"'
    )
    expect(fsWrites(commands)).toEqual([])
    expect(getTabById(tab.id)).toBeDefined()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('saving a document opened from a .pen file names the .fig beside it', async () => {
    const commands = recordNativeFs()
    const tab = createTab()
    tab.store.setDocumentSource('notes.pen', 'pen', undefined, '/tmp/designs/notes.pen')
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    expect(tab.store.hasWritableSource()).toBe(false)
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow(
      '"/tmp/designs/notes.fig"'
    )
    expect(fsWrites(commands)).toEqual([])
    await request('save_file', { document_id: tab.id, path: '/tmp/designs/notes.fig' })
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  function tabWithHandle(name: string) {
    const opened = { count: 0 }
    const handle = asDouble<FileSystemFileHandle>({
      name,
      getFile: async () => asDouble<File>({ lastModified: 0 }),
      createWritable: async () => {
        opened.count += 1
        return asDouble<FileSystemWritableFileStream>({
          write: async () => undefined,
          close: async () => undefined
        })
      }
    })
    const tab = createTab()
    tab.store.setDocumentSource(name, 'fig', handle)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    return { tab, opened }
  }

  test('saving over a .pen browser handle does not open it for writing', async () => {
    const { tab, opened } = tabWithHandle('notes.pen')
    expect(tab.store.getDocumentFilePath()).toBeNull()
    expect(tab.store.hasWritableSource()).toBe(true)
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow()
    expect(opened.count).toBe(0)
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with save over a .pen browser handle does not open it for writing', async () => {
    const { tab, opened } = tabWithHandle('notes.pen')
    await expect(request('close_file', { document_id: tab.id, unsaved: 'save' })).rejects.toThrow()
    expect(opened.count).toBe(0)
    expect(getTabById(tab.id)).toBeDefined()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('saving over a .fig browser handle still writes', async () => {
    const { tab, opened } = tabWithHandle('notes.fig')
    await request('save_file', { document_id: tab.id })
    expect(opened.count).toBe(1)
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  /** Save As installs this handle, then the first open fails and later opens write. */
  function pickedHandle(name: string) {
    const calls = { createWritable: 0, write: 0 }
    let fail = true
    const handle = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name,
      getFile: async () => asDouble<File>({ lastModified: 0 }),
      createWritable: async () => {
        calls.createWritable += 1
        if (fail) {
          fail = false
          throw new Error('disk full')
        }
        return asDouble<FileSystemWritableFileStream>({
          write: async () => {
            calls.write += 1
          },
          close: async () => undefined
        })
      }
    })
    return { handle, calls }
  }

  async function failSaveAs(tab: ReturnType<typeof createTab>, name: string) {
    const picked = pickedHandle(name)
    vi.spyOn(saveTargets, 'chooseBrowserFigSaveHandle').mockResolvedValue(picked.handle)
    await expect(tab.store.saveFigFileAs()).rejects.toThrow()
    return picked
  }

  test('a failed Save As to .fig is what the next save writes', async () => {
    const imported = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'notes.pen',
      getFile: async () => asDouble<File>({ lastModified: 0 })
    })
    const tab = createTab()
    tab.store.setDocumentSource('notes.pen', 'pen', imported)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const picked = await failSaveAs(tab, 'copy.fig')
    expect(tab.store.getSourceIdentity().handle?.name).toBe('notes.pen')
    await request('save_file', { document_id: tab.id })
    expect(picked.calls).toEqual({ createWritable: 2, write: 1 })
    expect(tab.store.hasUnsavedChanges()).toBe(false)
  })

  test('a failed Save As to .pen is not written by the next save', async () => {
    const imported = asDouble<FileSystemFileHandle>({
      kind: 'file',
      name: 'notes.fig',
      getFile: async () => asDouble<File>({ lastModified: 0 })
    })
    const tab = createTab()
    tab.store.setDocumentSource('notes.fig', 'fig', imported)
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const picked = await failSaveAs(tab, 'notes.pen')
    expect(tab.store.getSourceIdentity().handle?.name).toBe('notes.fig')
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow()
    expect(picked.calls).toEqual({ createWritable: 1, write: 0 })
    expect(tab.store.hasUnsavedChanges()).toBe(true)
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

  test('saving to a .pen path fails before the server writes anything', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('save_file', {
        document_id: tab.id,
        path: '/root/kuan-2d-framework.pen'
      })
    ).rejects.toThrow('"/root/kuan-2d-framework.fig"')
    expect(fetch).not.toHaveBeenCalled()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
    expect(tab.store.hasWritableSource()).toBe(false)
  })

  test('the extension check is case-insensitive and still writes a .FIG file', async () => {
    const pen = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('save_file', { document_id: pen.id, path: '/root/copy.PEN' })
    ).rejects.toThrow('"/root/copy.fig"')
    expect(fetch).not.toHaveBeenCalled()
    expect(pen.store.hasUnsavedChanges()).toBe(true)

    const fig = dirtyTab()
    await requestThroughServer('save_file', { document_id: fig.id, path: '/root/copy.FIG' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://mcp.test/files//root/copy.FIG')
    expect(fig.store.hasUnsavedChanges()).toBe(false)
  })

  test('a board may save as .jam, and a design may not', async () => {
    const board = dirtyTab()
    board.store.setDocumentKind('board')
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await requestThroughServer('save_file', { document_id: board.id, path: '/root/board.jam' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://mcp.test/files//root/board.jam')
    expect(board.store.hasUnsavedChanges()).toBe(false)

    const design = dirtyTab()
    await expect(
      requestThroughServer('save_file', { document_id: design.id, path: '/root/design.jam' })
    ).rejects.toThrow('"/root/design.fig"')
    expect(fetch.mock.calls).toHaveLength(1)
    expect(design.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with a save to a .pen path writes nothing and keeps the tab', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('close_file', {
        document_id: tab.id,
        unsaved: 'save',
        path: '/root/copy.pen'
      })
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
    expect(getTabById(tab.id)).toBeDefined()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('a new document is not left open when its path is not a .fig file', async () => {
    const before = getTabsSnapshot().map((tab) => tab.id)
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('new_document', { path: '/root/fresh.pen' })
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
    expect(getTabsSnapshot().map((tab) => tab.id)).toEqual(before)
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

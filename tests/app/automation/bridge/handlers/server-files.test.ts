import 'fake-indexeddb/auto'
import { describe, expect, test, vi } from 'bun:test'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { automationFiles } from '@/app/automation/bridge/server'
import { createTab, getActiveStore, getTabById, getTabsSnapshot, switchTab } from '@/app/tabs'

import {
  settle,
  useAutomationHandlerGlobals,
  type AutomationResponse
} from '#tests/helpers/automation/handlers'
import { testPath } from '#tests/helpers/paths'

useAutomationHandlerGlobals()

describe('file paths in a browser go through the MCP server', () => {
  const { handleRequest: handleThroughServer } = createAutomationCommandHandlers(
    makeFigmaFromStore,
    automationFiles('ws://mcp.test', 'token')
  )
  const requestThroughServer = (command: string, args: Record<string, unknown>) =>
    handleThroughServer(getActiveStore(), command, args) as Promise<AutomationResponse>

  function dirtyTab() {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    return tab
  }

  test('saving to a path hands the server a copy, saved as a download is', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await requestThroughServer('save_document', { document_id: tab.id, path: '/root/copy.fig' })

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
      requestThroughServer('save_document', { document_id: tab.id, path: '/elsewhere/copy.fig' })
    ).rejects.toThrow('Could not write /elsewhere/copy.fig: outside')
    expect(tab.store.hasUnsavedChanges()).toBe(true)
  })

  test('saving to a .pen path fails before the server writes anything', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('save_document', {
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
      requestThroughServer('save_document', { document_id: pen.id, path: '/root/copy.PEN' })
    ).rejects.toThrow('"/root/copy.fig"')
    expect(fetch).not.toHaveBeenCalled()
    expect(pen.store.hasUnsavedChanges()).toBe(true)

    const fig = dirtyTab()
    await requestThroughServer('save_document', { document_id: fig.id, path: '/root/copy.FIG' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://mcp.test/files//root/copy.FIG')
    expect(fig.store.hasUnsavedChanges()).toBe(false)
  })

  test('a board may save as .jam, and a design may not', async () => {
    const board = dirtyTab()
    board.store.setDocumentKind('board')
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await requestThroughServer('save_document', { document_id: board.id, path: '/root/board.jam' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://mcp.test/files//root/board.jam')
    expect(board.store.hasUnsavedChanges()).toBe(false)

    const design = dirtyTab()
    await expect(
      requestThroughServer('save_document', { document_id: design.id, path: '/root/design.jam' })
    ).rejects.toThrow('"/root/design.fig"')
    expect(fetch.mock.calls).toHaveLength(1)
    expect(design.store.hasUnsavedChanges()).toBe(true)
  })

  test('closing with a save to a .pen path writes nothing and keeps the tab', async () => {
    const tab = dirtyTab()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await expect(
      requestThroughServer('close_document', {
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
      requestThroughServer('create_document', { path: '/root/fresh.pen' })
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
    expect(getTabsSnapshot().map((tab) => tab.id)).toEqual(before)
  })

  test('opening a path fetches it from the server with the token', async () => {
    const bytes = new Uint8Array(await Bun.file(testPath('fixtures', 'slots.fig')).arrayBuffer())
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    await settle(requestThroughServer('open_document', { path: '/root/my #1 slots.fig' }))

    const [url, init] = fetch.mock.calls[0]
    // A reserved character stays in the path rather than starting a fragment.
    expect(String(url)).toBe('http://mcp.test/files//root/my%20%231%20slots.fig')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token')
    expect(getActiveStore().state.documentName).toBe('my #1 slots')
  })

  test('opening answers with the opened document even if another tab comes to the front meanwhile', async () => {
    const other = dirtyTab()
    const bytes = new Uint8Array(await Bun.file(testPath('fixtures', 'slots.fig')).arrayBuffer())
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes))
    // The person switches tabs while the file is read.
    globalThis.requestAnimationFrame = (callback) => {
      switchTab(other.id)
      callback(0)
      return 0
    }

    const response = await settle(
      requestThroughServer('open_document', { path: '/root/slots.fig' })
    )

    expect(getActiveStore()).toBe(other.store)
    expect(response.target?.documentId).not.toBe(other.id)
    expect(getTabById(String(response.target?.documentId))?.store.state.documentName).toBe('slots')
  })
})

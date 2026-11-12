import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { createHomeTab, createTab, getActiveStore, getActiveTabId } from '@/app/tabs'

const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)

function request(command: string, args: Record<string, unknown> = {}) {
  return handleRequest(getActiveStore(), command, args) as Promise<{
    ok: boolean
    result: unknown
    target?: { documentId: string }
  }>
}

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window.
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

// Home carries an empty editor the window never shows as a design: an agent's edits there were
// reported as done and could never be seen.
describe('automation while the selected tab is Home', () => {
  test('lists only the documents', async () => {
    const doc = createTab()
    const home = createHomeTab()

    const response = await request('list_documents')

    const { documents } = response.result as { documents: { id: string }[] }
    const ids = documents.map((entry) => entry.id)
    expect(ids).toContain(doc.id)
    expect(ids).not.toContain(home.id)
  })

  test('a call that names no document fails and names the open ones', async () => {
    const doc = createTab()
    const home = createHomeTab()

    await expect(request('eval', { code: 'figma.createRectangle()' })).rejects.toThrow(
      `The selected tab is Home, not a document. Pass document_id`
    )
    await expect(request('tree')).rejects.toThrow(`${doc.id} ("${doc.store.state.documentName}")`)
    expect(home.store.graph.getChildren(home.store.state.currentPageId)).toHaveLength(0)
  })

  test('a call naming Home finds no document', async () => {
    const home = createHomeTab()

    await expect(request('tree', { document_id: home.id })).rejects.toThrow(
      `Document "${home.id}" not found`
    )
  })

  test('a call naming a document works on it', async () => {
    const doc = createTab()
    createHomeTab()

    const response = await request('eval', {
      document_id: doc.id,
      code: 'figma.createRectangle(); return figma.currentPage.children.length'
    })

    expect(response.result).toBe(1)
    expect(response.target?.documentId).toBe(doc.id)
  })

  test('create_document opens a document and works on it', async () => {
    createHomeTab()

    const response = await request('create_document')

    expect(response.result).toEqual({ created: true })
    expect(response.target?.documentId).toBe(getActiveTabId())
  })
})

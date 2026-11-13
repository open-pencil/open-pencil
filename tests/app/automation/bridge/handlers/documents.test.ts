import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { toRaw } from 'vue'

import { forgetAgentChat, startAgentRun } from '@/app/ai/reply/run'
import { recentDocuments } from '@/app/recent-files'
import { recentFilesLimit } from '@/app/recent-files/preferences'
import { appPreferences } from '@/app/settings/preferences/store'
import { createTab, getActiveTabId, getTabById, switchTab } from '@/app/tabs'

import { request, settle, useAutomationHandlerGlobals } from '#tests/helpers/automation/handlers'

useAutomationHandlerGlobals()

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

describe('graph commands', () => {
  test('read the page page_id names rather than the first page', async () => {
    const { store } = createTab()
    const pageId = store.graph.addPage('Second').id
    store.graph.createNode('FRAME', pageId, { name: 'On Second' })

    const response = await settle(request('tree', { page_id: pageId }))

    expect(response.result).toMatchObject({
      page: { id: pageId, name: 'Second' },
      children: [{ name: 'On Second' }]
    })
    expect(response.target).toMatchObject({ pageId })
  })
})

describe("an ACP chat's tool calls", () => {
  const chat = '0123456789abcdef0123456789abcdef'
  afterEach(() => forgetAgentChat(chat))

  test("go to the chat's document unless they name another", async () => {
    // The agent's cursor glides over frames; here only where the calls land matters.
    globalThis.requestAnimationFrame = () => 0
    const chatTab = createTab()
    startAgentRun(chatTab.store, chat)
    const other = createTab()
    expect(getActiveTabId()).toBe(other.id)
    const shape = { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 }
    const agent = { session: 'session-1', kind: 'acp', chat }

    const inChat = await request('tool', { name: 'create_shape', args: shape, agent })
    const named = await request('tool', {
      document_id: other.id,
      name: 'create_shape',
      args: shape,
      agent
    })

    expect(inChat.target?.documentId).toBe(chatTab.id)
    expect(named.target?.documentId).toBe(other.id)
    expect((await request('undo', { agent })).target?.documentId).toBe(chatTab.id)
  })

  test('fail once the chat is gone, unless they name a document', async () => {
    const tab = createTab()
    startAgentRun(tab.store, chat)
    forgetAgentChat(chat)
    const agent = { session: 'session-1', kind: 'acp', chat }

    for (const named of [{}, { document_id: '' }]) {
      await expect(
        request('close_document', { ...named, agent, unsaved: 'discard' })
      ).rejects.toThrow('The chat this agent works for is closed')
    }
    expect(getTabById(tab.id)).toBeDefined()
    expect((await request('undo', { agent, document_id: tab.id })).target?.documentId).toBe(tab.id)
  })
})

describe("an MCP client's calls that name no document", () => {
  const shape = { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 }
  const draw = (agent: object, named: object = {}) =>
    request('tool', { ...named, name: 'create_shape', args: shape, agent })

  beforeEach(() => {
    // The agent's cursor glides over frames; here only where the calls land matters.
    globalThis.requestAnimationFrame = () => 0
  })
  afterEach(async () => {
    for (const session of ['mcp-1', 'mcp-2']) await request('agent_session_closed', { session })
  })

  test('stay on the document the session last worked on when another tab comes to the front', async () => {
    const first = createTab()
    const agent = { session: 'mcp-1', kind: 'mcp' }
    expect((await draw(agent)).target?.documentId).toBe(first.id)

    const second = createTab()
    expect(getActiveTabId()).toBe(second.id)

    expect((await draw(agent)).target?.documentId).toBe(first.id)
    expect((await request('undo', { agent })).target?.documentId).toBe(first.id)
  })

  test('follow the document the session last named, activated, or created', async () => {
    const first = createTab()
    const second = createTab()
    const agent = { session: 'mcp-1', kind: 'mcp' }

    await draw(agent, { document_id: first.id })
    expect((await draw(agent)).target?.documentId).toBe(first.id)

    await request('activate_document', { document_id: second.id, agent })
    switchTab(first.id)
    expect((await draw(agent)).target?.documentId).toBe(second.id)

    const created = await request('create_document', { agent })
    switchTab(first.id)
    expect((await draw(agent)).target?.documentId).toBe(created.target?.documentId)
  })

  test('keep each session on its own document', async () => {
    const first = createTab()
    const one = { session: 'mcp-1', kind: 'mcp' }
    const two = { session: 'mcp-2', kind: 'mcp' }
    await draw(one)
    const second = createTab()
    await draw(two)

    switchTab(first.id)
    expect((await draw(two)).target?.documentId).toBe(second.id)
    switchTab(second.id)
    expect((await draw(one)).target?.documentId).toBe(first.id)
  })

  test('fail once that document closes, and go to the front tab after the session ends', async () => {
    const first = createTab()
    const agent = { session: 'mcp-1', kind: 'mcp' }
    await draw(agent)
    const second = createTab()
    await request('close_document', { document_id: first.id, unsaved: 'discard' })

    await expect(draw(agent)).rejects.toThrow()
    expect(second.store.graph.getChildren(second.store.state.currentPageId)).toHaveLength(0)

    await request('agent_session_closed', { session: 'mcp-1' })
    expect((await draw(agent)).target?.documentId).toBe(second.id)
  })
})

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

describe('list_recent_documents', () => {
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

    const response = await request('list_recent_documents')

    expect(response.result).toEqual({
      files: [
        { path: '/a.fig', name: 'a.fig', updated_at: updatedAt },
        { path: '/b.fig', name: 'b.fig', updated_at: updatedAt }
      ]
    })
  })
})

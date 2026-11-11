import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import type { WebMCP } from 'webmcp-types'

import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { acquireDocumentEdit } from '@/app/automation/execution/lock'
import { webmcpMode } from '@/app/automation/webmcp/preferences'
import { startWebMCP, webmcpRuntime } from '@/app/automation/webmcp/runtime'
import { closeTab, createTab } from '@/app/tabs'

import {
  installAutomationGlobals,
  trackAutomationRenderer
} from '#tests/helpers/automation/renderer-lifecycle'

let tab: ReturnType<typeof createTab>
let tracker: ReturnType<typeof trackAutomationRenderer>
let restoreGlobals: () => void
let stop: (() => void) | undefined
let previousMode: typeof webmcpMode.value
let tools: Map<string, WebMCP.ModelContextTool>
let nodeId: string

beforeEach(async () => {
  restoreGlobals = installAutomationGlobals()
  tab = createTab()
  nodeId = tab.store.graph.createNode('RECTANGLE', tab.store.state.currentPageId).id
  tracker = trackAutomationRenderer(tab.store)
  vi.spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation(tracker.makeFigma)
  tools = new Map()
  const context: Pick<WebMCP.ModelContext, 'registerTool'> = {
    async registerTool(
      tool: WebMCP.ModelContextTool,
      options?: WebMCP.ModelContextRegisterToolOptions
    ) {
      tools.set(tool.name, tool)
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true })
    }
  }
  Object.defineProperty(document, 'modelContext', { configurable: true, value: context })
  previousMode = webmcpMode.value
  webmcpMode.value = 'edit'
  stop = startWebMCP(() => tab.store)
  for (let step = 0; step < 200 && webmcpRuntime.status === 'starting'; step++) {
    await Promise.resolve()
  }
  expect(webmcpRuntime.status).toBe('ready')
})

afterEach(async () => {
  stop?.()
  stop = undefined
  webmcpMode.value = previousMode
  tracker.dispose()
  vi.restoreAllMocks()
  try {
    await closeTab(tab.id, 'discard')
  } finally {
    restoreGlobals()
  }
})

async function setFill(signal = new AbortController().signal) {
  const tool = tools.get('set_fill')
  if (!tool) throw new Error('set_fill was not registered')
  return tool.execute({ id: nodeId, color: '#ff0000' }, { signal })
}

describe('registered WebMCP request renderer subscriptions', () => {
  test('repeated mutations release subscriptions and remain undoable', async () => {
    const baseline = tracker.active
    const originalFills = structuredClone(tab.store.graph.getNode(nodeId)?.fills)
    for (let call = 0; call < 3; call++) {
      const pending = setFill()
      expect(tracker.active).toBeGreaterThan(baseline)
      const result = await pending
      expect(result).toContain('"ok":true')
      expect(result).toContain(`"id":"${nodeId}"`)
      expect(tracker.active).toBe(baseline)
      expect(tab.store.graph.getNode(nodeId)?.fills).toMatchObject([
        { type: 'SOLID', color: { r: 1, g: 0, b: 0 } }
      ])
      expect(tab.store.undo.undo()).toBe('WebMCP: set_fill')
      expect(tab.store.graph.getNode(nodeId)?.fills).toEqual(originalFills)
    }
  })

  test('cancellation after API creation releases its subscription while the lock is held', async () => {
    const baseline = tracker.active
    const originalFills = structuredClone(tab.store.graph.getNode(nodeId)?.fills)
    const controller = new AbortController()
    const release = await acquireDocumentEdit(tab.store)
    const pending = setFill(controller.signal)
    try {
      expect(tracker.active).toBeGreaterThan(baseline)
      await Promise.resolve()
      await Promise.resolve()
      controller.abort(new Error('WebMCP cancelled'))
      await expect(pending).rejects.toThrow('WebMCP cancelled')
      expect(tracker.active).toBe(baseline)
      expect(tab.store.graph.getNode(nodeId)?.fills).toEqual(originalFills)
      expect(tab.store.undo.canUndo).toBe(false)
    } finally {
      controller.abort()
      release()
      await pending.catch(() => undefined)
    }
  })
})

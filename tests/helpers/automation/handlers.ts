import { afterEach, beforeEach, vi } from 'bun:test'

import * as layoutModule from '@open-pencil/core/layout'
import { asDouble } from '@open-pencil/test-support/doubles'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { getActiveStore, getTabsSnapshot } from '@/app/tabs'

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
    fonts: { add: vi.fn(), ready: Promise.resolve() },
    // An agent's cursor looks for the canvas it follows; nothing renders here.
    querySelector: () => null
  })
  globalThis.requestAnimationFrame = window.requestAnimationFrame
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame
}

/** The app's automation command handlers, which take the store a command starts from. */
export const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)

/** What an automation command answers, as the specs read it. */
export type AutomationResponse = {
  ok: boolean
  result: Record<string, unknown>
  target?: { documentId: string; pageId: string }
}

/**
 * Gives each spec in the file the window, document, and frame callbacks the editor needs
 * outside a browser, with layout skipped, and takes them away after it.
 */
export function useAutomationHandlerGlobals(): void {
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
}

/** Page switches wait for the canvas to present; nothing renders here, so acknowledge it. */
export async function settle<T>(pending: Promise<T>): Promise<T> {
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

/** Runs an automation command against the tab in front, as the MCP server sends it. */
export function request(
  command: string,
  args: Record<string, unknown> = {}
): Promise<AutomationResponse> {
  return handleRequest(getActiveStore(), command, args) as Promise<AutomationResponse>
}

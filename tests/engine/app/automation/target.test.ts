import { describe, expect, test, vi } from 'bun:test'

import { listAutomationDocuments, resolveAutomationTarget } from '@/app/automation/bridge/target'
import { createHomeTab } from '@/app/tabs'

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

describe('automation document targets', () => {
  test('does not expose the Home placeholder as an open document', () => {
    setupGlobals()
    const home = createHomeTab()

    expect(listAutomationDocuments(home.store)).not.toContainEqual(
      expect.objectContaining({ id: home.id })
    )
    expect(() => resolveAutomationTarget(home.store, undefined)).toThrow(
      'No active OpenPencil document'
    )
  })

  test('still permits Home as the host for opening a real document', () => {
    setupGlobals()
    const home = createHomeTab()

    expect(resolveAutomationTarget(home.store, undefined, { allowHome: true }).documentId).toBe(
      home.id
    )
  })
})

import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { openDemoDocument, openTour } from '@/app/demo/document'
import { createEditorStore } from '@/app/editor/session'
import { getActiveStore, getTabsSnapshot } from '@/app/tabs'

const originalFetch = globalThis.fetch

/** A fetch of the demo that runs `meanwhile` before the bytes arrive, as a user could. */
function stubDemoFetch(meanwhile: () => void = () => undefined, ok = true) {
  globalThis.fetch = Object.assign(
    async () => {
      meanwhile()
      return new Response(new Uint8Array([1, 2, 3]), { status: ok ? 200 : 404 })
    },
    { preconnect: originalFetch.preconnect }
  )
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('opening the demo', () => {
  test('opens the bundled file in a tab that is still blank', async () => {
    const store = createEditorStore()
    const open = spyOn(store, 'openFigFile').mockResolvedValue(undefined)
    stubDemoFetch()
    await openDemoDocument(store)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]?.[0].name).toBe('Demo.fig')
  })

  test('leaves a tab alone once something was drawn while the demo loaded', async () => {
    const store = createEditorStore()
    const open = spyOn(store, 'openFigFile').mockResolvedValue(undefined)
    stubDemoFetch(() => {
      store.graph.createNode('RECTANGLE', store.state.currentPageId, { width: 10, height: 10 })
    })
    await openDemoDocument(store)
    expect(open).not.toHaveBeenCalled()
  })

  test('fails when the bundled file is missing', async () => {
    const store = createEditorStore()
    stubDemoFetch(undefined, false)
    await expect(openDemoDocument(store)).rejects.toThrow('The demo document is unavailable (404)')
  })
})

describe('opening the tour', () => {
  test('closes its blank tab again when the tour fails to load', async () => {
    const documents = () => getTabsSnapshot().filter((tab) => tab.kind === 'document')
    const before = documents().map((tab) => tab.id)
    stubDemoFetch(undefined, false)
    await expect(openTour()).rejects.toThrow('The demo document is unavailable (404)')
    // Closing the last document shows Home, which is not a document tab.
    expect(documents().map((tab) => tab.id)).toEqual(before)
  })

  test('keeps its tab when something was drawn there before the failure', async () => {
    const documents = () => getTabsSnapshot().filter((tab) => tab.kind === 'document')
    const before = documents().length
    stubDemoFetch(() => {
      const store = getActiveStore()
      store.graph.createNode('RECTANGLE', store.state.currentPageId, { width: 10, height: 10 })
    }, false)
    await expect(openTour()).rejects.toThrow()
    expect(documents()).toHaveLength(before + 1)
  })
})

import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { openDemoDocument } from '@/app/demo/document'
import { createEditorStore } from '@/app/editor/session'

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

import { describe, expect, test } from 'bun:test'

import { setActiveEditorStore, useEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'

/**
 * `useEditorStore()` hands out a proxy so components keep working across tab switches.
 * It must be indistinguishable from the store it fronts: a missing trap falls through to
 * the proxy's empty target and quietly lies. That cost us a real bug — `sizeCanvas`
 * guarded its viewport sync with `'setViewportSize' in editor`, which was always false,
 * so deck slides never re-fitted when the canvas resized.
 */
describe('active editor store proxy', () => {
  test('answers `in` for methods the real store exposes', () => {
    const store = createEditorStore()
    setActiveEditorStore(store)
    const proxy = useEditorStore()

    for (const method of ['setViewportSize', 'zoomToFit', 'zoomToBounds', 'setDocumentKind']) {
      expect(typeof proxy[method as keyof typeof proxy]).toBe('function')
      expect(method in proxy).toBe(true)
    }
    expect('definitelyNotAStoreMethod' in proxy).toBe(false)
  })

  test('exposes the real store keys to enumeration', () => {
    const store = createEditorStore()
    setActiveEditorStore(store)

    expect(Object.keys(useEditorStore())).toEqual(Object.keys(store))
  })

  test('forwards writes through to the active store', () => {
    const store = createEditorStore()
    setActiveEditorStore(store)

    useEditorStore().state.documentKind = 'deck'

    expect(store.state.documentKind).toBe('deck')
  })

  test('follows the active store when tabs switch', () => {
    const first = createEditorStore()
    const second = createEditorStore()
    setActiveEditorStore(first)
    const proxy = useEditorStore()

    first.state.documentKind = 'deck'
    expect(proxy.state.documentKind).toBe('deck')

    setActiveEditorStore(second)
    expect(proxy.state.documentKind).toBe('design')
  })
})

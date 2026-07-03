import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { readFigFile } from '@open-pencil/core/io/formats/fig'
import * as figMod from '@open-pencil/core/io/formats/fig'
import * as layoutMod from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createTab, getActiveStore, openFileInNewTab, tabCount } from '@/app/tabs'

function setupGlobals() {
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    },
    cancelAnimationFrame: vi.fn(),
    openPencil: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as Window & typeof globalThis

  globalThis.document = {
    fonts: { add: vi.fn(), ready: Promise.resolve() }
  } as Document

  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame
  globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame
}

function teardownGlobals() {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
  Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
}

describe('openFileInNewTab', () => {
  beforeEach(() => {
    setupGlobals()
    vi.clearAllMocks()
    vi.spyOn(layoutMod, 'computeAllLayouts').mockReturnValue(undefined)
    vi.spyOn(figMod, 'readFigFile').mockResolvedValue(new SceneGraph())
    createTab()
  })

  afterEach(() => {
    teardownGlobals()
    vi.restoreAllMocks()
  })

  test('does not reuse a tab that has a non-empty redo stack', async () => {
    const originalStore = getActiveStore()
    originalStore.undo.apply({
      label: 'draw',
      forward: () => void 0,
      inverse: () => void 0
    })
    originalStore.undo.undo()
    expect(originalStore.undo.canRedo).toBe(true)

    ;(readFigFile as ReturnType<typeof vi.fn>).mockResolvedValue(new SceneGraph())
    await openFileInNewTab(new File([], 'file.fig'), undefined, '/new/file.fig')

    expect(tabCount()).toBe(2)
    expect(originalStore.getSourcePath()).toBeNull()
  })

  test('concurrent opens of different files can overlap I/O', async () => {
    // Verify concurrency through explicit synchronization — no timing
    // thresholds, no Date.now(), no flakiness. The mock blocks each
    // readFigFile call on a shared `proceed` promise and signals a
    // `bothStarted` barrier when the second call enters. If the lock
    // incorrectly serialized I/O (not just identity resolution), the
    // second mock would never start before `proceed` resolves and
    // `bothStarted` would never fire.
    let startedCount = 0
    let resolveBothStarted!: () => void
    const bothStarted = new Promise<void>((resolve) => {
      resolveBothStarted = resolve
    })
    let resolveProceed!: () => void
    const proceed = new Promise<void>((resolve) => {
      resolveProceed = resolve
    })

    ;(readFigFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      startedCount++
      if (startedCount === 2) resolveBothStarted()
      await proceed
      return new SceneGraph()
    })

    const done = Promise.all([
      openFileInNewTab(new File([], 'a.fig'), undefined, '/a.fig'),
      openFileInNewTab(new File([], 'b.fig'), undefined, '/b.fig')
    ])

    // Wait until both I/O operations are in-flight concurrently.
    await bothStarted
    expect(startedCount).toBe(2)

    // Release the mocks so the operations can complete.
    resolveProceed()
    const [first, second] = await done

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
  })

  test('routes HTML files through DOM import on the claimed tab', async () => {
    const store = getActiveStore()
    const openDOMFile = vi.spyOn(store, 'openDOMFile').mockResolvedValue(undefined)

    const file = new File(['<main>Hello</main>'], 'card.html', { type: 'text/html' })
    await openFileInNewTab(file, undefined, '/imports/card.html')

    expect(openDOMFile).toHaveBeenCalledWith(file, {
      handle: undefined,
      path: '/imports/card.html'
    })
    expect(getActiveStore()).toBe(store)
    expect(store.getSourcePath()).toBe('/imports/card.html')
  })

  describe('when the file read fails', () => {
    test('clears source identity and resets the name of a reused untouched tab', async () => {
      const store = getActiveStore()
      expect(store.state.documentName).toBe('Untitled')

      ;(readFigFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('read failed'))

      await expect(
        openFileInNewTab(new File([], 'file.fig'), undefined, '/failure/reused.fig')
      ).rejects.toThrow('read failed')

      expect(getActiveStore()).toBe(store)
      expect(store.getSourcePath()).toBeNull()
      expect(store.getSourceFileName()).toBeNull()
      expect(store.state.documentName).toBe('Untitled')
    })

    test('closes a freshly-created tab and leaves the original active tab unchanged', async () => {
      const originalStore = getActiveStore()
      originalStore.setDocumentSource('existing.fig', 'pen', undefined, '/existing.fig')

      expect(getActiveStore().getSourcePath()).toBe('/existing.fig')

      ;(readFigFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('read failed'))

      await expect(
        openFileInNewTab(new File([], 'file.fig'), undefined, '/failure/fresh.fig')
      ).rejects.toThrow('read failed')

      expect(getActiveStore()).toBe(originalStore)
      expect(originalStore.getSourcePath()).toBe('/existing.fig')
    })

    test('allows retrying the same file after a failed read', async () => {
      const store = getActiveStore()

      ;(readFigFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('read failed'))

      await expect(
        openFileInNewTab(new File([], 'file.fig'), undefined, '/failure/retry.fig')
      ).rejects.toThrow('read failed')

      expect(store.getSourcePath()).toBeNull()
      expect(store.state.documentName).toBe('Untitled')

      ;(readFigFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new SceneGraph())

      await openFileInNewTab(new File([], 'file.fig'), undefined, '/failure/retry.fig')

      expect(store.getSourcePath()).toBe('/failure/retry.fig')
      expect(store.state.documentName).toBe('file')
    })

    test('clears preclaimed source identity when DOM import fails', async () => {
      const store = getActiveStore()
      vi.spyOn(store, 'openDOMFile').mockRejectedValue(new Error('dom failed'))

      await expect(
        openFileInNewTab(
          new File(['<main>Broken</main>'], 'broken.html'),
          undefined,
          '/broken.html'
        )
      ).rejects.toThrow('dom failed')

      expect(getActiveStore()).toBe(store)
      expect(store.getSourcePath()).toBeNull()
      expect(store.getSourceFileName()).toBeNull()
      expect(store.state.documentName).toBe('Untitled')
    })
  })
})

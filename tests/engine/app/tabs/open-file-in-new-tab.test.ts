import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { SceneGraph } from '@open-pencil/core/scene-graph'

vi.mock('@open-pencil/core/io/formats/fig', () => ({
  readFigFile: vi.fn()
}))

vi.mock('@open-pencil/core/layout', () => ({
  computeAllLayouts: vi.fn()
}))

import { readFigFile } from '@open-pencil/core/io/formats/fig'

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
    createTab()
  })

  afterEach(() => {
    teardownGlobals()
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
    const delays: number[] = []
    ;(readFigFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const start = Date.now()
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30)
      })
      delays.push(Date.now() - start)
      return new SceneGraph()
    })

    const [first, second] = await Promise.all([
      openFileInNewTab(new File([], 'a.fig'), undefined, '/a.fig'),
      openFileInNewTab(new File([], 'b.fig'), undefined, '/b.fig')
    ])

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(delays).toHaveLength(2)
    // If the load work happened sequentially under the lock, both delays
    // would be at least 60 ms. After the fix each should resolve in ~30 ms.
    expect(Math.min(...delays)).toBeLessThan(45)
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
  })
})

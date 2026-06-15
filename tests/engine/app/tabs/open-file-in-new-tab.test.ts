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
})

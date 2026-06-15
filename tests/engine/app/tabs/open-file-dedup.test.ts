import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { createEditorStore } from '@/app/editor/session'
import type { Tab } from '@/app/tabs'
import { createFileOpenLock, findExistingTab, normalizeFilePath } from '@/app/tabs/identity'

let tabCounter = 0

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
}

function teardownGlobals() {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
}

function makeTab(): Tab {
  return { id: `tab-${++tabCounter}`, store: createEditorStore() }
}

function makeHandle(
  name: string,
  isSameEntry: (other: FileSystemFileHandle) => Promise<boolean>
): FileSystemFileHandle {
  return { name, isSameEntry } as FileSystemFileHandle
}

describe('normalizeFilePath', () => {
  test('collapses separators and removes trailing slash', () => {
    expect(normalizeFilePath('C:\\\\Users\\\\joeyc\\\\file.fig')).toBe('C:/Users/joeyc/file.fig')
    expect(normalizeFilePath('/Users/joeyc//file.fig/')).toBe('/Users/joeyc/file.fig')
    expect(normalizeFilePath('/Users/joeyc/file.fig')).toBe('/Users/joeyc/file.fig')
  })
})

describe('findExistingTab', () => {
  beforeEach(setupGlobals)
  afterEach(teardownGlobals)

  test('matches by normalized path', async () => {
    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', undefined, '/Users/joeyc/file.fig')

    const found = await findExistingTab(
      [tab],
      undefined,
      '/Users//joeyc\\\\file.fig',
      'file.fig'
    )
    expect(found?.id).toBe(tab.id)

    const notFound = await findExistingTab([tab], undefined, '/other/file.fig', 'file.fig')
    expect(notFound).toBeNull()
  })

  test('matches by FileSystemFileHandle.isSameEntry', async () => {
    const known = makeHandle('file.fig', async () => true)
    const other = makeHandle('other.fig', async () => false)

    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', known)

    const found = await findExistingTab([tab], known, undefined, 'file.fig')
    expect(found?.id).toBe(tab.id)

    const notFound = await findExistingTab([tab], other, undefined, 'other.fig')
    expect(notFound).toBeNull()
  })

  test('treats a rejected isSameEntry as "not the same file"', async () => {
    const bad = makeHandle('file.fig', async () => {
      throw new Error('permission denied')
    })
    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', bad)

    const found = await findExistingTab([tab], bad, undefined, 'file.fig')
    expect(found).toBeNull()
  })

  test('falls back to source file name', async () => {
    const tab = makeTab()
    tab.store.setDocumentSource('design.fig', 'pen')

    const found = await findExistingTab([tab], undefined, undefined, 'design.fig')
    expect(found?.id).toBe(tab.id)

    const notFound = await findExistingTab([tab], undefined, undefined, 'other.fig')
    expect(notFound).toBeNull()
  })

  test('prefers path identity over handle identity', async () => {
    const handle = makeHandle('file.fig', async () => false)
    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', handle, '/a/file.fig')

    const byPath = await findExistingTab([tab], undefined, '/a/file.fig', 'file.fig')
    expect(byPath?.id).toBe(tab.id)

    const byHandle = await findExistingTab([tab], handle, undefined, 'file.fig')
    expect(byHandle).toBeNull()
  })
})

describe('createFileOpenLock', () => {
  beforeEach(setupGlobals)
  afterEach(teardownGlobals)

  test('serializes duplicate opens so the second switches to the first-created tab', async () => {
    const tabs: Tab[] = []
    const lock = createFileOpenLock(() => tabs)
    const file = new File([], 'design.fig')

    const operation = vi.fn(async (existingTab: Tab | null) => {
      if (existingTab) return 'switch'
      // Simulate async load and then register the tab.
      await Promise.resolve()
      const tab = makeTab()
      tab.store.setDocumentSource('design.fig', 'pen', undefined, '/a/design.fig')
      tabs.push(tab)
      return 'opened'
    })

    const [first, second] = await Promise.all([
      lock.run(undefined, '/a/design.fig', file, operation),
      lock.run(undefined, '/a/design.fig', file, operation)
    ])

    expect(first).toBe('opened')
    expect(second).toBe('switch')
    expect(tabs).toHaveLength(1)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('lets a second open retry when the first attempt fails', async () => {
    const tabs: Tab[] = []
    const lock = createFileOpenLock(() => tabs)
    const file = new File([], 'design.fig')

    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      await Promise.resolve()
      throw new Error(`attempt ${attempts} failed`)
    })

    await expect(lock.run(undefined, '/a/design.fig', file, operation)).rejects.toThrow(
      'attempt 1 failed'
    )
    await expect(lock.run(undefined, '/a/design.fig', file, operation)).rejects.toThrow(
      'attempt 2 failed'
    )

    expect(attempts).toBe(2)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('allows concurrent opens for different keys', async () => {
    const tabs: Tab[] = []
    const lock = createFileOpenLock(() => tabs)

    let inflight = 0
    let maxInflight = 0

    const operation = async (existingTab: Tab | null, key: string) => {
      if (existingTab) return 'switch'
      inflight++
      maxInflight = Math.max(maxInflight, inflight)
      await Promise.resolve()
      const tab = makeTab()
      tab.store.setDocumentSource(`${key}.fig`, 'pen', undefined, `/a/${key}.fig`)
      tabs.push(tab)
      inflight--
      return 'opened'
    }

    const [first, second] = await Promise.all([
      lock.run(undefined, '/a/one.fig', new File([], 'one.fig'), (existing) =>
        operation(existing, 'one')
      ),
      lock.run(undefined, '/a/two.fig', new File([], 'two.fig'), (existing) =>
        operation(existing, 'two')
      )
    ])

    expect(first).toBe('opened')
    expect(second).toBe('opened')
    expect(tabs).toHaveLength(2)
    expect(maxInflight).toBe(2)
  })
})

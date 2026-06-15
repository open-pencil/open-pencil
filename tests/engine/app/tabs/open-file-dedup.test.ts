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

function overridePlatform(platform: string): () => void {
  const original = process.platform
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  return () => {
    Object.defineProperty(process, 'platform', { value: original, configurable: true })
  }
}

describe('normalizeFilePath', () => {
  test('collapses forward slashes and removes trailing slash on Linux', () => {
    const restore = overridePlatform('linux')
    try {
      expect(normalizeFilePath('/Users/joeyc//file.fig/')).toBe('/Users/joeyc/file.fig')
      expect(normalizeFilePath('/Users/joeyc/file.fig')).toBe('/Users/joeyc/file.fig')
    } finally {
      restore()
    }
  })

  test('preserves backslashes on POSIX platforms', () => {
    const restore = overridePlatform('linux')
    try {
      expect(normalizeFilePath('/Users/joeyc/my\\file.fig')).toBe('/Users/joeyc/my\\file.fig')
    } finally {
      restore()
    }
  })

  test('converts backslashes to slashes on Windows', () => {
    const restore = overridePlatform('win32')
    try {
      expect(normalizeFilePath('C:\\Users\\joeyc\\file.fig')).toBe('c:/users/joeyc/file.fig')
    } finally {
      restore()
    }
  })

  test('preserves UNC prefix on Windows', () => {
    const restore = overridePlatform('win32')
    try {
      expect(normalizeFilePath('\\\\server\\share\\file.fig')).toBe('//server/share/file.fig')
      expect(normalizeFilePath('\\\\server\\share\\dir\\')).toBe('//server/share/dir')
    } finally {
      restore()
    }
  })

  test('folds case on macOS and Windows', () => {
    let restore = overridePlatform('darwin')
    try {
      expect(normalizeFilePath('/Users/JoeyC/File.fig')).toBe('/users/joeyc/file.fig')
    } finally {
      restore()
    }
    restore = overridePlatform('win32')
    try {
      expect(normalizeFilePath('/Users/JoeyC/File.fig')).toBe('/users/joeyc/file.fig')
    } finally {
      restore()
    }
  })

  test('keeps case on Linux', () => {
    const restore = overridePlatform('linux')
    try {
      expect(normalizeFilePath('/Users/JoeyC/File.fig')).toBe('/Users/JoeyC/File.fig')
    } finally {
      restore()
    }
  })
})

describe('findExistingTab', () => {
  beforeEach(setupGlobals)
  afterEach(teardownGlobals)

  test('matches by normalized path on POSIX', async () => {
    const restore = overridePlatform('linux')
    try {
      const tab = makeTab()
      tab.store.setDocumentSource('file.fig', 'pen', undefined, '/Users/joeyc/file.fig')

      const found = await findExistingTab([tab], undefined, '/Users//joeyc/file.fig')
      expect(found?.id).toBe(tab.id)

      const notFound = await findExistingTab([tab], undefined, '/other/file.fig')
      expect(notFound).toBeNull()
    } finally {
      restore()
    }
  })

  test('matches by normalized Windows path', async () => {
    const restore = overridePlatform('win32')
    try {
      const tab = makeTab()
      tab.store.setDocumentSource('file.fig', 'pen', undefined, 'C:/Users/joeyc/file.fig')

      const found = await findExistingTab([tab], undefined, 'C:\\\\Users\\\\joeyc\\\\file.fig')
      expect(found?.id).toBe(tab.id)
    } finally {
      restore()
    }
  })

  test('matches by FileSystemFileHandle.isSameEntry', async () => {
    const known = makeHandle('file.fig', async () => true)
    const other = makeHandle('other.fig', async () => false)

    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', known)

    const found = await findExistingTab([tab], known)
    expect(found?.id).toBe(tab.id)

    const notFound = await findExistingTab([tab], other)
    expect(notFound).toBeNull()
  })

  test('treats a rejected isSameEntry as "not the same file"', async () => {
    const bad = makeHandle('file.fig', async () => {
      throw new Error('permission denied')
    })
    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', bad)

    const found = await findExistingTab([tab], bad)
    expect(found).toBeNull()
  })

  test('does not deduplicate by file name alone', async () => {
    const tab = makeTab()
    tab.store.setDocumentSource('design.fig', 'pen')

    const found = await findExistingTab([tab], undefined, undefined)
    expect(found).toBeNull()
  })

  test('prefers path identity and does not fall back to handle identity', async () => {
    const handle = makeHandle('file.fig', async () => false)
    const tab = makeTab()
    tab.store.setDocumentSource('file.fig', 'pen', handle, '/a/file.fig')

    const byPath = await findExistingTab([tab], undefined, '/a/file.fig')
    expect(byPath?.id).toBe(tab.id)

    const byHandle = await findExistingTab([tab], handle)
    expect(byHandle).toBeNull()
  })
})

describe('createFileOpenLock', () => {
  beforeEach(setupGlobals)
  afterEach(teardownGlobals)

  test('serializes duplicate opens so the second switches to the first-created tab', async () => {
    const tabs: Tab[] = []
    const lock = createFileOpenLock(() => tabs)

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
      lock.run(undefined, '/a/design.fig', operation),
      lock.run(undefined, '/a/design.fig', operation)
    ])

    expect(first).toBe('opened')
    expect(second).toBe('switch')
    expect(tabs).toHaveLength(1)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('lets a second open retry when the first attempt fails', async () => {
    const tabs: Tab[] = []
    const lock = createFileOpenLock(() => tabs)

    let attempts = 0
    const operation = vi.fn(async () => {
      attempts++
      await Promise.resolve()
      throw new Error(`attempt ${attempts} failed`)
    })

    await expect(lock.run(undefined, '/a/design.fig', operation)).rejects.toThrow(
      'attempt 1 failed'
    )
    await expect(lock.run(undefined, '/a/design.fig', operation)).rejects.toThrow(
      'attempt 2 failed'
    )

    expect(attempts).toBe(2)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('serializes concurrent opens for different keys', async () => {
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
      lock.run(undefined, '/a/one.fig', (existing) => operation(existing, 'one')),
      lock.run(undefined, '/a/two.fig', (existing) => operation(existing, 'two'))
    ])

    expect(first).toBe('opened')
    expect(second).toBe('opened')
    expect(tabs).toHaveLength(2)
    // Global serialization means only one open is in flight at a time.
    expect(maxInflight).toBe(1)
  })
})

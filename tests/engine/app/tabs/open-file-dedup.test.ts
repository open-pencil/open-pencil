import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import * as figModule from '@open-pencil/core/io/formats/fig'
import * as layoutModule from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

import { resolveBrowserFileURL } from '@/app/document/io/browser'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { createTab, getActiveStore, openFileInNewTab, tabCount } from '@/app/tabs'
import { fileIdentitiesMatch, findTabByFileIdentity } from '@/app/tabs/open/identity'

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

function makeHandle(
  name: string,
  isSameEntry: (other: FileSystemFileHandle) => Promise<boolean>
): FileSystemFileHandle {
  return { kind: 'file', name, isSameEntry } as FileSystemFileHandle
}

describe('file identity', () => {
  test('matches equivalent handles without using file names as identity', async () => {
    const stored = makeHandle('design.fig', async (other) => other.name === 'alias.fig')
    const alias = makeHandle('alias.fig', async () => false)
    const sameName = makeHandle('design.fig', async () => false)

    await expect(
      fileIdentitiesMatch({ handle: stored, path: null }, { handle: alias, path: null })
    ).resolves.toBe(true)
    await expect(
      fileIdentitiesMatch({ handle: stored, path: null }, { handle: sameName, path: null })
    ).resolves.toBe(false)
  })

  test('ignores an asynchronous handle match after the tab source changes', async () => {
    const comparison = Promise.withResolvers<boolean>()
    const started = Promise.withResolvers<undefined>()
    const storedHandle = makeHandle('stored.fig', async () => {
      started.resolve(undefined)
      return comparison.promise
    })
    const incomingHandle = makeHandle('incoming.fig', async () => false)
    let storedIdentity: DocumentSourceIdentity = { handle: storedHandle, path: null }
    const tab = { store: { getSourceIdentity: () => storedIdentity } }

    const finding = findTabByFileIdentity([tab], {
      handle: incomingHandle,
      path: null
    })
    await started.promise
    storedIdentity = { handle: storedHandle, path: '/other.fig' }
    comparison.resolve(true)

    await expect(finding).resolves.toBeNull()
  })

  test('finds a tab by path and ignores tabs without stable identity', async () => {
    const matchedIdentity = { handle: null, path: '/tmp/design.fig' }
    const matched = {
      store: { getSourceIdentity: () => matchedIdentity }
    }
    const unidentifiedIdentity = { handle: null, path: null }
    const unidentified = {
      store: { getSourceIdentity: () => unidentifiedIdentity }
    }

    await expect(
      findTabByFileIdentity([unidentified, matched], {
        handle: null,
        path: '/tmp/design.fig'
      })
    ).resolves.toBe(matched)
    await expect(
      findTabByFileIdentity([unidentified], { handle: null, path: null })
    ).resolves.toBeNull()
  })
})

describe('openFileInNewTab deduplication', () => {
  beforeEach(() => {
    setupGlobals()
    vi.spyOn(layoutModule, 'computeAllLayouts').mockReturnValue(undefined)
    vi.spyOn(figModule, 'readFigFile').mockResolvedValue(new SceneGraph())
    createTab()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  })

  test('canonicalizes browser URLs before using them as file identity', () => {
    expect(resolveBrowserFileURL('/design.fig#selection').href).toBe('http://localhost/design.fig')
  })

  test('activates the existing tab when the same path is opened again', async () => {
    const initialCount = tabCount()
    const file = new File([], 'design.fig')

    await openFileInNewTab(file, undefined, '/tmp/design.fig')
    const openedStore = getActiveStore()
    await openFileInNewTab(file, undefined, '/tmp/design.fig')

    expect(tabCount()).toBe(initialCount)
    expect(getActiveStore()).toBe(openedStore)
    expect(figModule.readFigFile).toHaveBeenCalledTimes(1)
  })

  test('shares one load between concurrent opens of the same path', async () => {
    const started = Promise.withResolvers<undefined>()
    const read = Promise.withResolvers<SceneGraph>()
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
      started.resolve(undefined)
      return read.promise
    })
    const initialCount = tabCount()
    const file = new File([], 'concurrent.fig')

    const first = openFileInNewTab(file, undefined, '/tmp/concurrent.fig')
    await started.promise
    const second = openFileInNewTab(file, undefined, '/tmp/concurrent.fig')
    await Promise.resolve()

    expect(figModule.readFigFile).toHaveBeenCalledTimes(1)
    read.resolve(new SceneGraph())
    await Promise.all([first, second])
    expect(tabCount()).toBe(initialCount)
  })

  test('allows different files to load concurrently', async () => {
    const reads = [Promise.withResolvers<SceneGraph>(), Promise.withResolvers<SceneGraph>()]
    const bothStarted = Promise.withResolvers<undefined>()
    let readIndex = 0
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const read = reads[readIndex++]
      if (readIndex === 2) bothStarted.resolve(undefined)
      return read?.promise ?? Promise.resolve(new SceneGraph())
    })
    const initialCount = tabCount()

    const first = openFileInNewTab(new File([], 'first.fig'), undefined, '/tmp/first.fig')
    const second = openFileInNewTab(new File([], 'second.fig'), undefined, '/tmp/second.fig')
    await bothStarted.promise

    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
    reads[0].resolve(new SceneGraph())
    reads[1].resolve(new SceneGraph())
    await Promise.all([first, second])
    expect(tabCount()).toBe(initialCount + 1)
  })

  test('removes a failed pending open so the file can be retried', async () => {
    ;(figModule.readFigFile as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(new SceneGraph())

    await expect(
      openFileInNewTab(new File([], 'retry.fig'), undefined, '/tmp/retry.fig')
    ).rejects.toThrow('read failed')
    await expect(
      openFileInNewTab(new File([], 'retry.fig'), undefined, '/tmp/retry.fig')
    ).resolves.toBeUndefined()

    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
    expect(getActiveStore().getSourceIdentity().path).toBe('/tmp/retry.fig')
  })

  test('keeps same-named files distinct without a path or handle', async () => {
    const initialCount = tabCount()
    const file = new File([], 'same-name.fig')

    await openFileInNewTab(file)
    await openFileInNewTab(file)

    expect(tabCount()).toBe(initialCount + 1)
    expect(figModule.readFigFile).toHaveBeenCalledTimes(2)
  })
})

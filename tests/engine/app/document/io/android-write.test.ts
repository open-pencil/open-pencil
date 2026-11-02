import { afterEach, beforeEach, describe, expect, mock, test, vi } from 'bun:test'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

/**
 * Android's save path differs from the desktop one in three places that a mistake would not
 * show until a device tried to save: the picker hands back a `content://` URI that is not a
 * path, the name comes from the provider rather than the string, and the target has to be
 * rolled back when the platform write fails. The cache directory and the two Tauri commands
 * are replaced here; everything below them is the shipped code.
 */

const cache = new Map<string, Uint8Array>()
const removals: string[] = []
const platformWrites: unknown[] = []

let providerName: string | null = 'Final.fig'
let providerRejects = false
let copyRejects = false
let writeRejects = false

vi.mock('@tauri-apps/api/path', () => ({ appCacheDir: async () => '/cache' }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Cache: 1 },
  writeFile: mock(async (name: string, data: Uint8Array) => {
    if (writeRejects) throw new Error('no space left')
    cache.set(name, data)
  }),
  remove: mock(async (name: string) => {
    removals.push(name)
    cache.delete(name)
  })
}))

const { androidDocumentName, createDocumentWriter } = await import('@/app/document/io/write')

const PICKED =
  'content://com.android.providers.downloads.documents/document/primary%3ADownload%2FFinal.fig'

const ANDROID_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
const DESKTOP_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'

type Environment = { android: boolean; tauri: boolean }

/**
 * Puts the process in the environment a case describes — the packaged app or a plain browser,
 * on Android or on a desktop. The changes land on globals, so they belong in `beforeEach`
 * rather than a `describe` body: Bun collects those bodies before the file's hooks run, which
 * would leave the first case of every block on the value the previous block left behind.
 */
function enterEnvironment({ android, tauri }: Environment): () => void {
  const userAgent = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userAgent')
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    configurable: true,
    get: () => (android ? ANDROID_AGENT : DESKTOP_AGENT)
  })

  return () => {
    if (userAgent) Object.defineProperty(globalThis.navigator, 'userAgent', userAgent)
    else Reflect.deleteProperty(globalThis.navigator, 'userAgent')
    if (tauri) return
    // `mockTauriIPC` installs the globals a packaged app has; a browser case must not inherit
    // them from the block before it.
    if ('window' in globalThis) Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, '__TAURI_INTERNALS__')
  }
}

function writerFor(filePath: string, onSuccess = mock(async () => undefined)) {
  const state = { documentName: 'Untitled' }
  const writer = createDocumentWriter({
    state,
    getFilePath: () => filePath,
    getFileHandle: () => null,
    getStorageBinding: () => null,
    setSavedVersion: mock(() => undefined),
    setLastWriteTime: mock(() => undefined),
    onWriteSuccess: onSuccess
  })
  return { writer, state, onSuccess }
}

/** Answers the two Android commands and records what the platform was asked to do. */
const answerPlatform = (command: string, args: Record<string, unknown> | undefined) => {
  if (command === 'content_uri_display_name') {
    if (providerRejects) throw new Error('provider refused')
    return providerName
  }
  if (command === 'write_content_uri') {
    platformWrites.push(args)
    if (copyRejects) throw new Error('resolver refused')
    return null
  }
  return null
}

afterEach(async () => {
  await clearTauriMocks()
  cache.clear()
  removals.length = 0
  platformWrites.length = 0
  providerName = 'Final.fig'
  providerRejects = false
  copyRejects = false
  writeRejects = false
})

describe('androidDocumentName', () => {
  test('asks the provider for the name the save sheet left on the document', async () => {
    await mockTauriIPC(answerPlatform)

    expect(await androidDocumentName(PICKED)).toBe('Final.fig')
  })

  test('decodes the name out of the document id when the provider answers nothing', async () => {
    providerName = null
    await mockTauriIPC(answerPlatform)

    expect(await androidDocumentName(PICKED)).toBe('Final.fig')
  })

  test('decodes the document id when the provider refuses the query', async () => {
    providerRejects = true
    await mockTauriIPC(answerPlatform)

    expect(await androidDocumentName(PICKED)).toBe('Final.fig')
  })

  test('returns null when neither the provider nor the id carries a name', async () => {
    providerName = null
    await mockTauriIPC(answerPlatform)

    expect(await androidDocumentName('content://provider/document/')).toBeNull()
  })

  test('a percent-escape that does not decode leaves the name to the provider', async () => {
    providerName = null
    await mockTauriIPC(answerPlatform)

    expect(
      await androidDocumentName('content://provider/document/primary%3ABad%E0%A4%A')
    ).toBeNull()
  })
})

describe('writing to a content:// target on Android', () => {
  let leave: () => void = () => undefined

  beforeEach(async () => {
    await mockTauriIPC(answerPlatform)
    leave = enterEnvironment({ android: true, tauri: true })
  })

  afterEach(() => {
    leave()
  })

  test('stages the bytes in the cache directory and hands the path to the platform', async () => {
    const { writer } = writerFor(PICKED)

    expect(await writer(new Uint8Array([1, 2, 3]), 7)).toBe(true)

    // The platform copies the staging file by path, so it reads out of the cache directory.
    expect(platformWrites).toHaveLength(1)
    const { uri, sourcePath } = platformWrites[0] as { uri: string; sourcePath: string }
    expect(uri).toBe(PICKED)
    expect(sourcePath).toMatch(/^\/cache\/openpencil-save-\d+-\d+\.fig$/)
    // And the staging file is gone once the copy has read it.
    expect(removals).toEqual([sourcePath.slice('/cache/'.length)])
    expect(cache.size).toBe(0)
  })

  test('two saves in the same millisecond stage under different names', async () => {
    const { writer } = writerFor(PICKED)
    await Promise.all([writer(new Uint8Array([1]), 1), writer(new Uint8Array([2]), 2)])

    const staged = removals.filter((name) => name.startsWith('openpencil-save-'))
    expect(new Set(staged).size).toBe(2)
  })

  test('removes the staged file when the platform copy fails', async () => {
    copyRejects = true
    const { writer } = writerFor(PICKED)

    await expect(writer(new Uint8Array([1]), 1)).rejects.toThrow('resolver refused')
    expect(cache.size).toBe(0)
  })

  test('removes the staged file when the disk is full before the copy starts', async () => {
    writeRejects = true
    const { writer } = writerFor(PICKED)

    await expect(writer(new Uint8Array([1]), 1)).rejects.toThrow('no space left')
    expect(removals).toHaveLength(1)
  })

  test('records the write before reporting success', async () => {
    const { writer, onSuccess } = writerFor(PICKED)

    expect(await writer(new Uint8Array([1]), 42)).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith(42)
  })
})

describe('a plain path on Android', () => {
  let leave: () => void = () => undefined

  beforeEach(async () => {
    await mockTauriIPC(answerPlatform)
    leave = enterEnvironment({ android: true, tauri: true })
  })

  afterEach(() => {
    leave()
  })

  test('still goes through the fs plugin rather than the platform', async () => {
    const { writer } = writerFor('/data/data/net.dannote.open_pencil/files/a.fig')

    expect(await writer(new Uint8Array([9]), 3)).toBe(true)
    expect(platformWrites).toHaveLength(0)
  })
})

describe('a content:// path on desktop', () => {
  let leave: () => void = () => undefined

  beforeEach(async () => {
    await mockTauriIPC(answerPlatform)
    leave = enterEnvironment({ android: false, tauri: true })
  })

  afterEach(() => {
    leave()
  })

  test('is written as a path rather than through the platform', async () => {
    const { writer } = writerFor(PICKED)

    expect(await writer(new Uint8Array([4]), 1)).toBe(true)
    expect(platformWrites).toHaveLength(0)
  })
})

describe('a browser build', () => {
  let leave: () => void = () => undefined

  beforeEach(() => {
    leave = enterEnvironment({ android: true, tauri: false })
  })

  afterEach(() => {
    leave()
  })

  test('reports no write to an Android page that is not the packaged app', async () => {
    const { writer } = writerFor(PICKED)

    // `isAndroid()` also answers true in an Android browser, where the platform commands do
    // not exist. Claiming success there would lose the file without telling anyone.
    expect(await writer(new Uint8Array([1]), 1)).toBe(false)
    expect(platformWrites).toHaveLength(0)
  })
})

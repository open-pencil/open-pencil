import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

function installLocalStorage() {
  const data = new Map<string, string>()
  const storage = {
    get length() {
      return data.size
    },
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null
  } satisfies Pick<Storage, 'length' | 'getItem' | 'setItem' | 'removeItem' | 'key'>

  const storageProp = ['local', 'Storage'].join('')
  Object.assign(globalThis, { window: Object.fromEntries([[storageProp, storage]]) })
  return data
}

// Install globalThis.window BEFORE any dynamic imports resolve so that
// IS_BROWSER (typeof window !== 'undefined') in @open-pencil/core/constants
// evaluates to true when the cache module loads its dependency chain.
beforeAll(() => {
  installLocalStorage()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('app cache', () => {
  test('stores text in the web cache namespace', async () => {
    const storage = installLocalStorage()
    const { readCacheText, writeCacheText } = await import('@/app/cache')

    await writeCacheText('providers/models', 'cached')

    expect(storage.get('open-pencil:cache:v1:providers/models')).toBe('cached')
    await expect(readCacheText('providers/models')).resolves.toBe('cached')
  })

  test('expires JSON values by max age', async () => {
    installLocalStorage()
    const { readCacheJson, writeCacheJson } = await import('@/app/cache')

    await writeCacheJson('json/key', { ok: true })

    await expect(readCacheJson('json/key', 60_000)).resolves.toEqual({ ok: true })
    await expect(readCacheJson('json/key', -1)).resolves.toBeNull()
  })

  test('removes a web cache prefix', async () => {
    installLocalStorage()
    const { readCacheText, removeCachePrefix, writeCacheText } = await import('@/app/cache')

    await writeCacheText('openrouter/models', 'models')
    await writeCacheText('openrouter/other', 'other')
    await writeCacheText('fonts/manifest', 'fonts')

    await removeCachePrefix('openrouter')

    await expect(readCacheText('openrouter/models')).resolves.toBeNull()
    await expect(readCacheText('openrouter/other')).resolves.toBeNull()
    await expect(readCacheText('fonts/manifest')).resolves.toBe('fonts')
  })
})

import { afterEach, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

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
    const { readCacheJSON, writeCacheJSON } = await import('@/app/cache')

    await writeCacheJSON('json/key', { ok: true })

    const schema = v.object({ ok: v.boolean() })
    await expect(readCacheJSON('json/key', schema, 60_000)).resolves.toEqual({ ok: true })
    await expect(readCacheJSON('json/key', schema, -1)).resolves.toBeNull()
  })

  test('reads malformed or mismatched JSON entries as missing', async () => {
    const storage = installLocalStorage()
    const { readCacheJSON, writeCacheJSON } = await import('@/app/cache')
    const schema = v.object({ ok: v.boolean() })

    storage.set('open-pencil:cache:v1:json/key', '{not json')
    await expect(readCacheJSON('json/key', schema)).resolves.toBeNull()
    storage.set('open-pencil:cache:v1:json/key', JSON.stringify({ value: { ok: true } }))
    await expect(readCacheJSON('json/key', schema)).resolves.toBeNull()
    await writeCacheJSON('json/key', { ok: 'yes' })
    await expect(readCacheJSON('json/key', schema)).resolves.toBeNull()
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

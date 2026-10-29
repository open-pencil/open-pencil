import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'

import * as v from 'valibot'

import * as cache from '@/app/cache'
import { cachedRemoteJSON } from '@/app/cache/remote'

import { fetchStub } from '#tests/helpers/fetch'

const namesSchema = v.array(v.string())

function remoteNames(load: (fetcher: typeof fetch) => Promise<string[] | null>) {
  return cachedRemoteJSON({ key: 'tests/names', schema: namesSchema, maxAgeMs: 60_000, load })
}

describe('cachedRemoteJSON', () => {
  const spies: { mockRestore(): void }[] = []
  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore()
  })

  test('shares one load between callers', async () => {
    const load = mock(async () => ['a'])
    const names = remoteNames(load)

    expect(await Promise.all([names.get(), names.get()])).toEqual([['a'], ['a']])
    expect(await names.get()).toEqual(['a'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  test('returns a cached value without loading', async () => {
    spies.push(spyOn(cache, 'readCacheJSON').mockResolvedValueOnce(['cached']))
    const load = mock(async () => ['fresh'])

    expect(await remoteNames(load).get()).toEqual(['cached'])
    expect(load).not.toHaveBeenCalled()
  })

  test('retries after a failed or empty load', async () => {
    const load = mock<() => Promise<string[] | null>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(['a'])
    const names = remoteNames(load)

    expect(await names.get()).toBeNull()
    expect(await names.get()).toBeNull()
    expect(await names.get()).toEqual(['a'])
    expect(load).toHaveBeenCalledTimes(3)
  })

  test('loads when the cache cannot be read and keeps the value when it cannot be written', async () => {
    spies.push(
      spyOn(cache, 'readCacheJSON').mockRejectedValueOnce(new Error('storage denied')),
      spyOn(cache, 'writeCacheJSON').mockRejectedValueOnce(new Error('quota exceeded'))
    )
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    spies.push(warn)
    const load = mock(async () => ['a'])
    const names = remoteNames(load)

    expect(await names.get()).toEqual(['a'])
    expect(await names.get()).toEqual(['a'])
    expect(load).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('loads through a passed fetcher without the cache or the shared request', async () => {
    const read = spyOn(cache, 'readCacheJSON')
    spies.push(read)
    const fetcher = fetchStub(async () => Response.json([]))
    const load = mock(async (used: typeof fetch) => (used === fetcher ? ['stub'] : ['shared']))
    const names = remoteNames(load)

    expect(await names.get(fetcher)).toEqual(['stub'])
    expect(await names.get()).toEqual(['shared'])
    expect(read).toHaveBeenCalledTimes(1)
  })
})

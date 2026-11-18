import type * as v from 'valibot'

import { anySignal, DEADLINE_MS } from '@open-pencil/std/timing'

import { readCacheJSON, writeCacheJSON } from './index'

export type CachedRemoteJSONOptions<TValue> = {
  key: string
  schema: v.GenericSchema<unknown, TValue>
  maxAgeMs: number
  /**
   * How long each request a load makes may take; an ordinary request's deadline by default, since
   * a caller usually waits on it and falls back to what it had.
   */
  deadlineMs?: number
  /** Fetches a fresh value; null means the response had nothing worth keeping. */
  load: (fetcher: typeof fetch) => Promise<TValue | null>
}

export type CachedRemoteJSON<TValue> = {
  /**
   * The cached value, or a fresh one shared by concurrent callers. A passed fetcher loads
   * directly, without the cache or the shared request.
   */
  get(fetcher?: typeof fetch): Promise<TValue | null>
  reset(): void
}

/**
 * A JSON value fetched over the network and cached for `maxAgeMs`. Storage failures only skip
 * the cache, and a failed or empty load is not kept, so the next call retries.
 */
export function cachedRemoteJSON<TValue>(
  options: CachedRemoteJSONOptions<TValue>
): CachedRemoteJSON<TValue> {
  let shared: Promise<TValue | null> | null = null
  const deadlineMs = options.deadlineMs ?? DEADLINE_MS.request
  /** `fetcher`, with every request it makes bounded by the deadline as well as its own signal. */
  const bounded =
    (fetcher: typeof fetch): typeof fetch =>
    (input, init) =>
      fetcher(input, {
        ...init,
        // A `Request` brings its own signal, which `init.signal` would otherwise replace.
        signal: anySignal([
          init?.signal ?? (input instanceof Request ? input.signal : undefined),
          AbortSignal.timeout(deadlineMs)
        ])
      })

  async function loadAndCache(): Promise<TValue | null> {
    const cached = await readCacheJSON(options.key, options.schema, options.maxAgeMs).catch(
      () => null
    )
    if (cached != null) return cached
    const value = await options.load(bounded(fetch))
    if (value == null) return null
    await writeCacheJSON(options.key, value).catch((error: unknown) => {
      console.warn(`Cache write skipped for "${options.key}":`, error)
    })
    return value
  }

  return {
    async get(fetcher) {
      if (fetcher) return options.load(bounded(fetcher)).catch(() => null)
      const pending = (shared ??= loadAndCache())
      const value = await pending.catch(() => null)
      if (value == null && shared === pending) shared = null
      return value
    },
    reset() {
      shared = null
    }
  }
}

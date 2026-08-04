import { afterEach, describe, expect, test } from 'bun:test'

import { listObjects, type AppwriteConfig } from '@/app/integrations/storage/appwrite/client'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'

const APPWRITE: AppwriteConfig = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'project-1',
  bucketId: 'bucket-1',
  apiKey: 'appwrite-api-key'
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/** Record the cache mode of every fetch call and answer with `body`. */
function spyFetch(body: () => Response): { caches: (RequestCache | undefined)[] } {
  const caches: (RequestCache | undefined)[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    caches.push(input instanceof Request ? input.cache : init?.cache)
    return body()
  }) as typeof fetch
  return { caches }
}

/**
 * The 2026-08-03 resurrection bug was the browser's HTTP cache honouring a
 * provider's `Cache-Control` header — a Playwright route mock cannot reproduce
 * a real browser cache, so the honest test lives at the seam: every storage
 * request must opt out of the cache. A future adapter that forgets fails here,
 * loudly, instead of resurrecting deleted documents six weeks later.
 */
describe('storage reads bypass the browser HTTP cache', () => {
  test('the S3 seam passes no-store for string and Request inputs', async () => {
    const spy = spyFetch(() => new Response('ok'))

    await storageFetch('https://s3.example.test/bucket/key', { method: 'GET' })
    await storageFetch(new Request('https://s3.example.test/bucket/key'), { method: 'GET' })

    expect(spy.caches).toHaveLength(2)
    expect(new Set(spy.caches)).toEqual(new Set(['no-store']))
  })

  test('the Appwrite seam passes no-store on every request', async () => {
    const spy = spyFetch(
      () =>
        new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    await listObjects(APPWRITE, 'bucket-1', 'open_pencil_storage/canvases/')

    expect(spy.caches.length).toBeGreaterThanOrEqual(1)
    expect(new Set(spy.caches)).toEqual(new Set(['no-store']))
  })
})

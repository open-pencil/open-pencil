import { expect, test } from 'bun:test'

import { createS3StorageAdapter } from '@/app/integrations/storage/s3/adapter'
import { readDownloadStream } from '@/app/integrations/storage/s3/client'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'

test('mid-stream cancellation discards partial bytes and stops progress', async () => {
  const abort = new AbortController()
  const progress: number[] = []
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]))
      queueMicrotask(() => controller.enqueue(new Uint8Array([3, 4])))
    },
    cancel() {
      cancelled = true
    }
  })
  const reading = readDownloadStream(
    stream,
    4,
    ({ receivedBytes }) => {
      progress.push(receivedBytes)
      abort.abort()
    },
    abort.signal
  )

  await expect(reading).rejects.toHaveProperty('name', 'AbortError')
  expect(progress).toEqual([2])
  expect(cancelled).toBe(true)
})

test('external storage cancellation remains an AbortError rather than a timeout', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true }
      )
    })) as typeof fetch
  const abort = new AbortController()
  const pending = storageFetch('https://storage.example.com/document.fig', {
    signal: abort.signal
  })
  abort.abort()
  try {
    await expect(pending).rejects.toHaveProperty('name', 'AbortError')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pre-aborted storage downloads do not resolve credentials or start network work', async () => {
  let credentialResolutions = 0
  const adapter = createS3StorageAdapter({
    preferences: {
      endpoint: 'https://storage.example.com',
      bucket: 'designs',
      region: 'auto'
    },
    async resolveCredential() {
      credentialResolutions++
      return 'secret'
    }
  })
  const abort = new AbortController()
  abort.abort()

  await expect(adapter.getDocument('document', undefined, abort.signal)).rejects.toHaveProperty(
    'name',
    'AbortError'
  )
  expect(credentialResolutions).toBe(0)
})

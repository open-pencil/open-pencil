import { expect, jest, spyOn, test } from 'bun:test'

import { createS3StorageAdapter } from '@/app/integrations/storage/s3/adapter'
import { readDownloadStream } from '@/app/integrations/storage/s3/client'
import { createStorageFetch, storageFetch } from '@/app/integrations/storage/s3/fetch'

import { expectDefined } from '#tests/helpers/assert'
import { fetchStub } from '#tests/helpers/fetch'

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
    profileId: 'default',
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

/** A download whose body sends one byte each time `send` is called, then ends on `end`. */
function trickle() {
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller
    }
  })
  return {
    response: new Response(body),
    send: () => stream?.enqueue(new Uint8Array([1])),
    end: () => stream?.close()
  }
}

async function withFetch(response: Response, run: () => Promise<void>) {
  const stub = spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(() => Promise.resolve(response))
  )
  try {
    await run()
  } finally {
    stub.mockRestore()
  }
}

test('a slow download that keeps arriving finishes however long it takes', async () => {
  jest.useFakeTimers()
  try {
    const download = trickle()
    await withFetch(download.response, async () => {
      const response = await createStorageFetch(100)('https://storage.example.com/document.fig')
      const reader = expectDefined(response.body, 'download body').getReader()
      // Five times the stall time in all, with most of it passing before each next byte.
      for (let sent = 0; sent < 5; sent++) {
        download.send()
        expect((await reader.read()).value).toEqual(new Uint8Array([1]))
        jest.advanceTimersByTime(90)
      }
      download.end()
      expect((await reader.read()).done).toBe(true)
    })
  } finally {
    jest.useRealTimers()
  }
})

test('a download that stops arriving fails as timed out', async () => {
  const download = trickle()
  await withFetch(download.response, async () => {
    const response = await createStorageFetch(20)('https://storage.example.com/document.fig')
    const reading = response.arrayBuffer()
    download.send()
    await expect(reading).rejects.toThrow('Storage request timed out')
  })
})

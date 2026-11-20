import { afterEach, describe, expect, test } from 'bun:test'

import { readBoundedBody } from '@open-pencil/core/io/remote'
import { fetchStub } from '@open-pencil/test-support/fetch'

import { downloadBlob, MAX_REMOTE_DOCUMENT_BYTES } from '@/app/document/io/browser'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'
const originalFetch = globalThis.fetch
const originalDocument = globalThis.document
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalDocument) Object.assign(globalThis, { document: originalDocument })
  else Reflect.deleteProperty(globalThis, 'document')
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

describe('openBrowserFileFromURL', () => {
  test('a remote document over the old 64 MiB cap still fits the ceiling', async () => {
    const MIB = 1024 * 1024
    const body = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(65 * MIB))
          controller.close()
        }
      })
    )

    const bytes = await readBoundedBody(body, MAX_REMOTE_DOCUMENT_BYTES)

    expect(bytes.byteLength).toBe(65 * MIB)
  })

  test('a remote document over 512 MiB is still refused', async () => {
    const MIB = 1024 * 1024
    const body = new Response(new ReadableStream<Uint8Array>(), {
      headers: { 'content-length': String(512 * MIB + 1) }
    })

    await expect(readBoundedBody(body, MAX_REMOTE_DOCUMENT_BYTES)).rejects.toThrow(
      'exceeds 512 MiB'
    )
  })

  test('refuses a response with no body instead of opening an empty document', async () => {
    globalThis.fetch = fetchStub(async () => new Response(null, { status: 200 }))

    await expect(openBrowserFileFromURL(new URL('https://example.com/design.pen'))).rejects.toThrow(
      'carried no body'
    )
  })
})

describe('downloadBlob', () => {
  test('downloads only the bytes of a view, not its whole backing buffer', async () => {
    const captured: { blob?: Blob } = {}
    URL.createObjectURL = (blob) => {
      captured.blob = blob as Blob
      return 'blob:test'
    }
    URL.revokeObjectURL = () => undefined
    Object.assign(globalThis, {
      document: {
        createElement: () => ({ style: {}, click: () => undefined }),
        body: { appendChild: () => undefined, removeChild: () => undefined }
      }
    })

    downloadBlob(new Uint8Array([0, 1, 2]).subarray(1), 'document.fig', 'application/octet-stream')
    // The anchor is removed and its URL revoked on a short timer; let it run before teardown.
    await Bun.sleep(150)

    const blob = captured.blob
    if (!blob) throw new Error('The download produced no blob')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
  })
})

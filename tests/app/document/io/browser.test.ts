import { afterEach, describe, expect, test } from 'bun:test'

import { fetchStub } from '@open-pencil/test-support/fetch'

import { downloadBlob } from '@/app/document/io/browser'
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

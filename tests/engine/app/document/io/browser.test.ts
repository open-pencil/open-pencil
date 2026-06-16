import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { downloadBlob } from '@/app/document/io/browser'

type BlobCall = {
  parts: unknown[] | undefined
  options: BlobPropertyBag | undefined
}

let blobCalls: BlobCall[] = []
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let anchorMocks: AnchorMock[] = []
let appendChild: ReturnType<typeof vi.fn>
let removeChild: ReturnType<typeof vi.fn>
let createElement: ReturnType<typeof vi.fn>
let originalBlob: typeof Blob
let originalURL: typeof URL
let originalDocument: Document | undefined

type AnchorMock = {
  href: string
  download: string
  click: ReturnType<typeof vi.fn>
  style: Record<string, string>
}

function setGlobal(key: string, value: unknown) {
  Reflect.set(globalThis, key, value)
}

function setupGlobals() {
  originalBlob = globalThis.Blob
  originalURL = globalThis.URL
  originalDocument = typeof document !== 'undefined' ? document : undefined

  blobCalls = []
  createObjectURL = vi.fn(() => 'blob:mock-url')
  revokeObjectURL = vi.fn()
  anchorMocks = []
  appendChild = vi.fn((el: AnchorMock) => {
    anchorMocks.push(el)
  })
  removeChild = vi.fn((el: AnchorMock) => {
    const index = anchorMocks.indexOf(el)
    if (index !== -1) {
      anchorMocks.splice(index, 1)
    }
  })
  createElement = vi.fn(() => {
    const mock: AnchorMock = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {}
    }
    return mock
  })

  class MockBlob {
    readonly parts: unknown[] | undefined
    readonly options: BlobPropertyBag | undefined

    constructor(parts?: unknown[], options?: BlobPropertyBag) {
      this.parts = parts
      this.options = options
      blobCalls.push({ parts, options })
    }
  }

  setGlobal('Blob', MockBlob as typeof Blob)
  setGlobal('URL', {
    createObjectURL,
    revokeObjectURL
  })
  setGlobal('document', {
    createElement,
    body: {
      appendChild,
      removeChild,
      style: {}
    }
  })
}

function teardownGlobals() {
  setGlobal('Blob', originalBlob)
  setGlobal('URL', originalURL)
  if (originalDocument === undefined) {
    Reflect.deleteProperty(globalThis, 'document')
  } else {
    setGlobal('document', originalDocument)
  }
  vi.useRealTimers()
}

describe('downloadBlob', () => {
  beforeEach(() => {
    setupGlobals()
    vi.useFakeTimers()
  })
  afterEach(teardownGlobals)

  test('passes the Uint8Array view to Blob, not the parent ArrayBuffer', () => {
    const parent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const subarray = parent.subarray(2, 5)

    expect(subarray.byteOffset).toBe(2)
    expect(subarray.byteLength).toBe(3)

    downloadBlob(subarray, 'file.bin', 'application/octet-stream')

    expect(blobCalls).toHaveLength(1)
    const [call] = blobCalls
    expect(call.parts).toHaveLength(1)
    if (call.parts == null) {
      throw new Error('Blob was constructed without parts')
    }

    const passed = call.parts[0] as Uint8Array
    expect(passed).toBe(subarray)
    expect(passed.byteLength).toBe(3)
    expect(passed.byteOffset).toBe(2)
    expect(call.options).toEqual({ type: 'application/octet-stream' })
  })

  test('configures the anchor and cleans up after the deferred timeout', () => {
    downloadBlob(new Uint8Array([9, 10, 11]), 'file.fig', 'application/octet-stream')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(anchorMocks).toHaveLength(1)

    const anchor = anchorMocks[0]
    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.download).toBe('file.fig')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(anchor.style.display).toBe('none')

    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(removeChild).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(anchorMocks).toHaveLength(0)
  })
})

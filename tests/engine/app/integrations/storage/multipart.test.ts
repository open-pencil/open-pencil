import { afterEach, describe, expect, test } from 'bun:test'

import {
  putObjectResumable,
  S3UploadSessionExpiredError
} from '@/app/integrations/storage/s3/client'
import type { UploadProgress } from '@/app/integrations/storage/s3/client'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'

const CONFIG: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret'
}

const KEY = 'open_pencil_storage/canvases/doc.fig'
const PART_SIZE = 8 * 1024 * 1024
const THRESHOLD = 16 * 1024 * 1024

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

type RecordedRequest = {
  method: string
  uploadId: string | null
  partNumber: number | null
  isCreate: boolean
  isComplete: boolean
  isPlainPut: boolean
  isAbort: boolean
  body: Uint8Array | null
}

type PartFault = { partNumber: number; status: number; code?: string; once: boolean }
type MockOptions = { faults?: PartFault[]; createFault?: { status: number; code?: string } }

function urlOf(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input)
  if (input instanceof URL) return input
  return new URL(input.url)
}

function requestBody(init?: RequestInit): Uint8Array | null {
  if (!init?.body) return null
  if (typeof init.body === 'string') return new TextEncoder().encode(init.body)
  return new Uint8Array(init.body as ArrayBuffer)
}

function errorXml(code: string, message: string): string {
  return `<Error><Code>${code}</Code><Message>${message}</Message></Error>`
}

/** A scripted S3 endpoint: records every request and injects per-part faults. */
function installMockS3(options: MockOptions = {}) {
  const requests: RecordedRequest[] = []
  const firedFaults = new Set<number>()
  let uploadCounter = 0

  function createResponse(): Response {
    if (options.createFault) {
      return new Response(errorXml(options.createFault.code ?? 'Error', 'create failed'), {
        status: options.createFault.status
      })
    }
    uploadCounter += 1
    return new Response(
      `<InitiateMultipartUploadResult><UploadId>upload-${uploadCounter}</UploadId></InitiateMultipartUploadResult>`,
      { status: 200 }
    )
  }

  function partResponse(partNumber: number): Response {
    const fault = options.faults?.find((candidate) => candidate.partNumber === partNumber)
    if (fault && (!fault.once || !firedFaults.has(partNumber))) {
      firedFaults.add(partNumber)
      return new Response(errorXml(fault.code ?? 'InternalError', 'injected'), {
        status: fault.status
      })
    }
    return new Response('', { status: 200, headers: { etag: `"etag-part-${partNumber}"` } })
  }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    const method = init?.method ?? 'GET'
    const partNumber = url.searchParams.has('partNumber')
      ? Number(url.searchParams.get('partNumber'))
      : null
    const uploadId = url.searchParams.get('uploadId')
    const isCreate = method === 'POST' && url.searchParams.has('uploads')
    const isComplete = method === 'POST' && uploadId !== null && partNumber === null
    const isAbort = method === 'DELETE' && uploadId !== null
    requests.push({
      method,
      uploadId,
      partNumber,
      isCreate,
      isComplete,
      isPlainPut: method === 'PUT' && partNumber === null && !uploadId,
      isAbort,
      body: requestBody(init)
    })

    if (isCreate) return createResponse()
    if (partNumber !== null) return partResponse(partNumber)
    if (isComplete) return new Response('<CompleteMultipartUploadResult/>', { status: 200 })
    if (isAbort) return new Response('', { status: 204 })
    return new Response('', { status: 200 })
  }) as typeof fetch

  return { requests }
}

function bigBody(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = i % 251
  return bytes
}

describe('multipart upload', () => {
  test('a small document keeps the single-PUT path', async () => {
    const mock = installMockS3()
    await putObjectResumable(CONFIG, KEY, new Uint8Array(1024), 'application/octet-stream')

    expect(mock.requests.filter((request) => request.isPlainPut)).toHaveLength(1)
    expect(mock.requests.filter((request) => request.isCreate)).toHaveLength(0)
  })

  test('a large document uploads as ordered parts and completes with opaque ETags', async () => {
    const mock = installMockS3()
    const size = THRESHOLD + 1024 * 1024 // 17 MB → 3 parts (8, 8, 1)
    const body = bigBody(size)

    await putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')

    const creates = mock.requests.filter((request) => request.isCreate)
    const parts = mock.requests.filter((request) => request.partNumber !== null)
    const completion = mock.requests.find((request) => request.isComplete)
    expect(creates).toHaveLength(1)
    expect(parts.map((request) => request.partNumber)).toEqual([1, 2, 3])
    expect(parts[0]?.body?.byteLength).toBe(PART_SIZE)
    expect(parts[2]?.body?.byteLength).toBe(size - 2 * PART_SIZE)
    // The reassembled parts are byte-identical to the source body.
    const reassembled = new Uint8Array(size)
    let offset = 0
    for (const part of parts) {
      reassembled.set(part.body ?? new Uint8Array(), offset)
      offset += part.body?.byteLength ?? 0
    }
    expect(reassembled).toEqual(body)
    // ETags are echoed verbatim into the completion — never parsed.
    const completionXml = new TextDecoder().decode(completion?.body)
    expect(completionXml).toContain(
      '<PartNumber>2</PartNumber><ETag>&quot;etag-part-2&quot;</ETag>'
        .replace('&quot;', '"')
        .replace('&quot;', '"')
    )
    expect(completionXml).toContain('"etag-part-1"')
    expect(completion?.uploadId).toBe('upload-1')
    expect(mock.requests.filter((request) => request.isPlainPut)).toHaveLength(0)
  })

  test('a failed part retries that part only — acknowledged parts are not re-sent', async () => {
    const mock = installMockS3({ faults: [{ partNumber: 2, status: 503, once: true }] })
    const body = bigBody(THRESHOLD + 1024 * 1024)

    await putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')

    const parts = mock.requests.filter((request) => request.partNumber !== null)
    expect(parts.filter((request) => request.partNumber === 1)).toHaveLength(1)
    expect(parts.filter((request) => request.partNumber === 2)).toHaveLength(2)
    expect(parts.filter((request) => request.partNumber === 3)).toHaveLength(1)
    expect(mock.requests.filter((request) => request.isComplete)).toHaveLength(1)
  })

  test('an expired session restarts and re-sends only unacknowledged parts', async () => {
    const mock = installMockS3({
      faults: [{ partNumber: 3, status: 404, code: 'NoSuchUpload', once: true }]
    })
    const body = bigBody(THRESHOLD + 1024 * 1024)

    await putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')

    // First session: parts 1-2 acknowledged, part 3 hits the dead session.
    // Second session: ONLY part 3 is sent; acknowledged parts stay acknowledged.
    expect(mock.requests.filter((request) => request.isCreate)).toHaveLength(2)
    expect(mock.requests.filter((request) => request.isAbort)).toHaveLength(1)
    const parts = mock.requests.filter((request) => request.partNumber !== null)
    expect(parts.filter((request) => request.partNumber === 1)).toHaveLength(1)
    expect(parts.filter((request) => request.partNumber === 2)).toHaveLength(1)
    expect(parts.filter((request) => request.partNumber === 3)).toHaveLength(2)
    expect(parts.filter((request) => request.uploadId === 'upload-2')).toHaveLength(1)
    expect(mock.requests.filter((request) => request.isComplete)).toHaveLength(1)
  })

  test('a session that stays dead fails the upload rather than looping forever', async () => {
    const mock = installMockS3({
      faults: [1, 2, 3].map((partNumber) => ({
        partNumber,
        status: 404,
        code: 'NoSuchUpload',
        once: false
      }))
    })
    const body = bigBody(THRESHOLD + 1024 * 1024)

    await expect(putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')).rejects.toThrow(
      S3UploadSessionExpiredError
    )

    // Two restarts plus the initial session, each aborted best-effort.
    expect(mock.requests.filter((request) => request.isCreate)).toHaveLength(3)
    expect(mock.requests.filter((request) => request.isAbort)).toHaveLength(3)
  })

  test('a permanent failure aborts the session and propagates', async () => {
    const mock = installMockS3({ faults: [{ partNumber: 1, status: 403, once: false }] })
    const body = bigBody(THRESHOLD + 1024 * 1024)

    await expect(
      putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')
    ).rejects.toThrow()
    expect(mock.requests.filter((request) => request.isAbort)).toHaveLength(1)
    expect(mock.requests.filter((request) => request.isComplete)).toHaveLength(0)
  })

  test('a 49 MB document survives a failure at 90% without re-transferring acknowledged parts', async () => {
    // The deck from the assessment's test data: the case where restarting
    // from zero actually hurts.
    const mock = installMockS3({ faults: [{ partNumber: 7, status: 503, once: true }] })
    const size = 49 * 1024 * 1024
    const body = bigBody(size)

    await putObjectResumable(CONFIG, KEY, body, 'application/octet-stream')

    const parts = mock.requests.filter((request) => request.partNumber !== null)
    // 49 MB → 7 parts (6 × 8 MB + 1 MB); only the failed last part repeats.
    expect(new Set(parts.map((request) => request.partNumber))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7])
    )
    expect(parts).toHaveLength(8)
    expect(parts.filter((request) => request.partNumber === 7)).toHaveLength(2)
    expect(mock.requests.filter((request) => request.isComplete)).toHaveLength(1)
  })

  test('progress is monotonic and ends at the full size', async () => {
    const mock = installMockS3({ faults: [{ partNumber: 2, status: 503, once: true }] })
    const size = THRESHOLD + 1024 * 1024
    const body = bigBody(size)
    const seen: UploadProgress[] = []

    await putObjectResumable(CONFIG, KEY, body, 'application/octet-stream', (progress) =>
      seen.push(progress)
    )

    expect(seen.length).toBeGreaterThan(0)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]?.sentBytes).toBeGreaterThanOrEqual(seen[i - 1]?.sentBytes ?? 0)
    }
    expect(seen.at(-1)?.sentBytes).toBe(size)
    expect(seen.at(-1)?.totalBytes).toBe(size)
    expect(mock.requests.length).toBeGreaterThan(0)
  })
})

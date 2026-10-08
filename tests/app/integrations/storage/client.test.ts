import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  S3HttpError,
  getObject,
  getObjectRange,
  headObject,
  listObjects,
  putObject
} from '@/app/integrations/storage/s3/client'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'

const config: S3CompatibleConfig = {
  endpoint: 'storage.example.com',
  bucket: 'designs',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  region: 'auto'
}

const originalFetch = globalThis.fetch
let requests: Request[] = []
let respond: (request: Request) => Response

beforeEach(() => {
  requests = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    return respond(request)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/xml' } })
}

describe('S3 client', () => {
  test('signs path-style requests that bypass the browser cache', async () => {
    respond = () => new Response('fig', { status: 200, headers: { 'content-length': '3' } })

    expect(await getObject(config, 'open_pencil_storage/canvases/a b.fig')).toEqual(
      new TextEncoder().encode('fig')
    )
    const [request] = requests
    const url = new URL(request?.url ?? '')
    expect(url.origin + url.pathname).toBe(
      'https://storage.example.com/designs/open_pencil_storage/canvases/a%20b.fig'
    )
    expect(request?.headers.get('authorization')).toStartWith('AWS4-HMAC-SHA256 ')
    expect(request?.cache).toBe('no-store')
  })

  test('follows list continuation tokens', async () => {
    respond = (request) =>
      new URL(request.url).searchParams.get('continuation-token') === 'a&b'
        ? xml(
            `<ListBucketResult><Contents><Key>second.fig</Key><Size>2</Size></Contents><IsTruncated>false</IsTruncated></ListBucketResult>`
          )
        : xml(
            `<ListBucketResult><Contents><Key>first.fig</Key><LastModified>2026-01-02T03:04:05.000Z</LastModified><Size>1</Size></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>a&amp;b</NextContinuationToken></ListBucketResult>`
          )

    expect(await listObjects(config, 'open_pencil_storage/')).toEqual([
      { key: 'first.fig', lastModified: '2026-01-02T03:04:05.000Z', size: 1 },
      { key: 'second.fig', lastModified: null, size: 2 }
    ])
    expect(new URL(requests[0]?.url ?? '').searchParams.get('prefix')).toBe('open_pencil_storage/')
  })

  test('treats missing objects as absent', async () => {
    respond = (request) =>
      request.method === 'HEAD'
        ? new Response(null, { status: 404 })
        : xml('<Error><Code>NoSuchKey</Code><Message>Missing</Message></Error>', 404)

    expect(await headObject(config, 'missing.fig')).toBe(false)
    expect(await getObject(config, 'missing.fig')).toBeNull()
  })

  test('reports provider errors with status and code', async () => {
    respond = () =>
      xml(
        '<Error><Code>AccessDenied</Code><Message>Key contains &lt;Code&gt;</Message></Error>',
        403
      )

    const error = await getObject(config, 'private.fig').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(S3HttpError)
    expect(error).toMatchObject({
      status: 403,
      code: 'AccessDenied',
      message: 'Key contains <Code>'
    })
  })

  test('accepts a byte range answered with 200 and a matching Content-Range', async () => {
    respond = () => new Response('ab', { status: 200, headers: { 'content-range': 'bytes 0-1/5' } })

    expect(await getObjectRange(config, 'document.fig', 0, 2)).toEqual(
      new TextEncoder().encode('ab')
    )
  })

  test('reports bodyless errors by status', async () => {
    respond = () => new Response(null, { status: 403 })

    await expect(headObject(config, 'private.fig')).rejects.toMatchObject({
      status: 403,
      code: null,
      message: 'S3 request failed with status 403'
    })
  })

  test('rejects a byte range answered with the whole object', async () => {
    respond = () => new Response('whole', { status: 200 })

    await expect(getObjectRange(config, 'document.fig', 0, 2)).rejects.toThrow(
      'Storage provider did not honor the thumbnail byte range'
    )
    expect(requests[0]?.headers.get('range')).toBe('bytes=0-1')
  })

  test('sends conditional writes without optional checksums', async () => {
    respond = () => new Response(null, { status: 200 })

    await putObject(config, 'library.json', '{}', 'application/json', undefined, {
      ifNoneMatch: '*'
    })
    const [request] = requests
    expect(request?.method).toBe('PUT')
    expect(request?.headers.get('if-none-match')).toBe('*')
    expect(request?.headers.get('content-type')).toBe('application/json')
    expect(request?.headers.get('content-length')).toBe('2')
    expect(
      [...(request?.headers.keys() ?? [])].some((name) => name.startsWith('x-amz-checksum'))
    ).toBe(false)
    expect(await request?.text()).toBe('{}')
  })
})

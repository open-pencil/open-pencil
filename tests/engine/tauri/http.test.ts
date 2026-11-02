import { afterEach, describe, expect, test } from 'bun:test'

import type { Channel } from '@tauri-apps/api/core'

import {
  createTauriFetch,
  tauriFetch,
  type ProxyHttpBodyMessage,
  type ProxyHttpError,
  type ProxyHttpHead,
  type ProxyHttpRequest
} from '@/app/tauri/http'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

type InvokeArgs = { request: ProxyHttpRequest; onBody: Channel<ProxyHttpBodyMessage> }

function bytes(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text)
  const buffer = new ArrayBuffer(encoded.byteLength)
  new Uint8Array(buffer).set(encoded)
  return buffer
}

/** Tauri rejects invoke() with the command's serialized error, not an Error. */
function desktopError(reason: ProxyHttpError): Promise<never> {
  const failure = Promise.withResolvers<never>()
  failure.reject(reason)
  return failure.promise
}

/** Answers like the desktop command: the head, then the body over the channel. */
function respond(
  args: unknown,
  head: Partial<ProxyHttpHead> & { status: number },
  body: ProxyHttpBodyMessage[] = []
): ProxyHttpHead {
  const { onBody } = args as InvokeArgs
  setTimeout(() => {
    for (const message of [...body, { done: true } as const]) onBody.onmessage(message)
  })
  return { headers: [], url: '', ...head }
}

function proxyBodyText(request: ProxyHttpRequest): string {
  return new TextDecoder().decode(new Uint8Array(request.body ?? []))
}

function proxyHeaderValue(request: ProxyHttpRequest, name: string): string | null {
  return request.headers?.find((header) => header.name.toLowerCase() === name)?.value ?? null
}

async function withBrowserStrictNullBodyResponse<T>(callback: () => Promise<T>): Promise<T> {
  const originalResponse = globalThis.Response
  const StrictResponse = class extends originalResponse {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      const status = init?.status
      if ((status === 204 || status === 205 || status === 304) && body != null) {
        throw new TypeError('Response with null body status cannot have body')
      }
      super(body, init)
    }
  } as typeof Response

  globalThis.Response = StrictResponse
  try {
    return await callback()
  } finally {
    globalThis.Response = originalResponse
  }
}

afterEach(async () => {
  await clearTauriMocks()
})

describe('tauriFetch', () => {
  test('routes IPC through the captured native fetch without invoking the HTTP proxy', async () => {
    await mockTauriIPC(() => {
      throw new Error('IPC recursively entered the HTTP proxy')
    })
    const inputs = [
      'ipc://localhost/plugin%3Ahttp%7Cfetch',
      'http://ipc.localhost/plugin%3Ahttp%7Cfetch',
      new URL('https://ipc.localhost/plugin%3Ahttp%7Cfetch'),
      new Request('http://ipc.localhost/plugin%3Ahttp%7Cfetch')
    ]
    const received: Array<RequestInfo | URL> = []
    const fetcher = createTauriFetch({
      nativeFetch: async (input) => {
        received.push(input)
        return new Response('native IPC')
      }
    })
    for (const input of inputs) expect(await (await fetcher(input)).text()).toBe('native IPC')
    expect(received).toEqual(inputs)
  })

  test('does not bypass HTTP proxy for URLs merely containing the IPC hostname', async () => {
    const received: string[] = []
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      received.push((args as InvokeArgs).request.url)
      return respond(args, { status: 204 })
    })
    const fetcher = createTauriFetch({
      nativeFetch: async () => {
        throw new Error('External URL bypassed the HTTP proxy')
      }
    })
    const urls = ['https://ipc.localhost.example.test/', 'https://example.test/ipc.localhost']
    for (const url of urls) await fetcher(url)
    expect(received).toEqual(urls)
  })

  test('passes request timeout metadata to the desktop HTTP command', async () => {
    const captured: { value: InvokeArgs | null } = { value: null }
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      captured.value = args as InvokeArgs
      return respond(args, { status: 201, headers: [{ name: 'x-lawha', value: 'ok' }] }, [
        bytes('OK')
      ])
    })

    const response = await createTauriFetch({ timeoutMs: 15_000 })('https://example.test/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}'
    })

    if (!captured.value) throw new Error('Expected proxy_http_request to be invoked')
    expect(response.status).toBe(201)
    expect(response.headers.get('x-lawha')).toBe('ok')
    expect(await response.text()).toBe('OK')
    expect(captured.value.request.url).toBe('https://example.test/check')
    expect(captured.value.request.method).toBe('POST')
    expect(captured.value.request.timeout_ms).toBe(15_000)
    expect(captured.value.request.body).toEqual([...new TextEncoder().encode('{"ok":true}')])
  })

  test('accepts URL objects without treating them as Requests', async () => {
    const captured: { value: InvokeArgs | null } = { value: null }
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      captured.value = args as InvokeArgs
      return respond(args, { status: 204 })
    })
    await tauriFetch(new URL('https://example.test/url-object'))
    if (!captured.value) throw new Error('Expected proxy_http_request to be invoked')
    expect(captured.value.request.url).toBe('https://example.test/url-object')
  })

  test('forwards bodies from Request inputs', async () => {
    const captured: { value: InvokeArgs | null } = { value: null }
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      captured.value = args as InvokeArgs
      return respond(args, { status: 204 })
    })

    const request = new Request('https://example.test/from-request', {
      method: 'POST',
      body: 'from-request'
    })

    const response = await tauriFetch(request)

    if (!captured.value) throw new Error('Expected proxy_http_request to be invoked')
    expect(response.status).toBe(204)
    expect(captured.value.request.method).toBe('POST')
    expect(proxyBodyText(captured.value.request)).toBe('from-request')
  })

  test('constructs null bodies for browser null-body response statuses', async () => {
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      return respond(args, { status: 204, headers: [{ name: 'x-no-content', value: '1' }] })
    })

    await withBrowserStrictNullBodyResponse(async () => {
      const response = await tauriFetch('https://example.test/no-content')

      expect(response.status).toBe(204)
      expect(response.headers.get('x-no-content')).toBe('1')
      expect(await response.text()).toBe('')
    })
  })

  test('forwards FormData bytes with the Request-generated content boundary', async () => {
    const captured: { value: InvokeArgs | null } = { value: null }
    await mockTauriIPC((command, args) => {
      expect(command).toBe('proxy_http_request')
      captured.value = args as InvokeArgs
      return respond(args, { status: 204 })
    })

    const formData = new FormData()
    formData.append('family', 'Inter')

    await tauriFetch('https://example.test/upload', { method: 'POST', body: formData })

    if (!captured.value) throw new Error('Expected proxy_http_request to be invoked')
    const contentType = proxyHeaderValue(captured.value.request, 'content-type')
    const boundary = contentType?.match(/boundary=(.+)$/)?.[1]
    if (!boundary) throw new Error(`Expected multipart boundary in content-type: ${contentType}`)

    const body = proxyBodyText(captured.value.request)
    expect(body).toContain(`--${boundary}`)
    expect(body).toContain('name="family"')
    expect(body).toContain('Inter')
  })

  test('rejects already-aborted requests before invoking the desktop command', async () => {
    let calls = 0
    await mockTauriIPC((_command, args) => {
      calls += 1
      return respond(args, { status: 204 })
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      tauriFetch('https://example.test/slow', { signal: controller.signal })
    ).rejects.toHaveProperty('name', 'AbortError')
    expect(calls).toBe(0)
  })

  test('cancels the desktop request when aborted before the head arrives', async () => {
    const cancelled: string[] = []
    const started = Promise.withResolvers<string>()
    await mockTauriIPC((command, args) => {
      if (command === 'cancel_http_request') {
        cancelled.push((args as { id: string }).id)
        return null
      }
      started.resolve((args as InvokeArgs).request.id)
      return Promise.withResolvers<never>().promise
    })
    const controller = new AbortController()

    const request = tauriFetch('https://example.test/slow', { signal: controller.signal })
    const id = await started.promise
    controller.abort()

    await expect(request).rejects.toHaveProperty('name', 'AbortError')
    expect(cancelled).toEqual([id])
  })

  test('streams body chunks as they arrive', async () => {
    const channel = Promise.withResolvers<Channel<ProxyHttpBodyMessage>>()
    await mockTauriIPC((_command, args) => {
      channel.resolve((args as InvokeArgs).onBody)
      return { status: 200, headers: [], url: '' }
    })

    const response = await tauriFetch('https://example.test/stream')
    const onBody = await channel.promise
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Expected a streamed body')

    onBody.onmessage(bytes('data: 1\n\n'))
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toBe('data: 1\n\n')

    onBody.onmessage(bytes('data: 2\n\n'))
    onBody.onmessage({ done: true })
    const second = await reader.read()
    expect(new TextDecoder().decode(second.value)).toBe('data: 2\n\n')
    expect((await reader.read()).done).toBe(true)
  })

  test('cancels the desktop request and fails the body when aborted mid-stream', async () => {
    const cancelled: string[] = []
    await mockTauriIPC((command, args) => {
      if (command === 'cancel_http_request') {
        cancelled.push((args as { id: string }).id)
        return null
      }
      return { status: 200, headers: [], url: '' }
    })
    const controller = new AbortController()

    const response = await tauriFetch('https://example.test/stream', { signal: controller.signal })
    controller.abort()

    await expect(response.text()).rejects.toHaveProperty('name', 'AbortError')
    expect(cancelled).toHaveLength(1)
  })

  test('reports network failures as fetch does, so callers can retry', async () => {
    await mockTauriIPC(() => desktopError({ network: true, message: 'operation timed out' }))

    const error = await tauriFetch('https://example.test/down').catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(TypeError)
    expect(error).toHaveProperty('message', 'fetch failed')
    expect(error).toHaveProperty('cause.message', 'operation timed out')
  })

  test('reports request errors with their message', async () => {
    await mockTauriIPC(() =>
      desktopError({ network: false, message: 'Only HTTP(S) requests are supported' })
    )

    await expect(tauriFetch('https://example.test/')).rejects.toThrow(
      'Only HTTP(S) requests are supported'
    )
  })

  test('fails the body when the connection drops mid-stream', async () => {
    await mockTauriIPC((_command, args) =>
      respond(args, { status: 200 }, [
        bytes('partial'),
        { error: { network: true, message: 'connection reset' } }
      ])
    )

    const response = await tauriFetch('https://example.test/stream')

    await expect(response.text()).rejects.toHaveProperty('cause.message', 'connection reset')
  })
})

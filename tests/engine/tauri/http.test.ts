import { afterEach, describe, expect, test } from 'bun:test'

import {
  createTauriFetch,
  tauriFetch,
  type ProxyHttpRequest,
  type ProxyHttpResponse
} from '@/app/tauri/http'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

type InvokeArgs = { request: ProxyHttpRequest }

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
      return { status: 204, headers: [], body: [] }
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
      return {
        status: 201,
        headers: [{ name: 'x-open-pencil', value: 'ok' }],
        body: [...new TextEncoder().encode('OK')]
      }
    })

    const response = await createTauriFetch({ timeoutMs: 15_000 })('https://example.test/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}'
    })

    if (!captured.value) throw new Error('Expected proxy_http_request to be invoked')
    expect(response.status).toBe(201)
    expect(response.headers.get('x-open-pencil')).toBe('ok')
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
      return { status: 204, headers: [], body: [] }
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
      return { status: 204, headers: [], body: [] }
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
    await mockTauriIPC((command) => {
      expect(command).toBe('proxy_http_request')
      return { status: 204, headers: [{ name: 'x-no-content', value: '1' }], body: [] }
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
      return { status: 204, headers: [], body: [] }
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
    await mockTauriIPC(() => {
      calls += 1
      return { status: 204, headers: [], body: [] }
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      tauriFetch('https://example.test/slow', { signal: controller.signal })
    ).rejects.toHaveProperty('name', 'AbortError')
    expect(calls).toBe(0)
  })

  test('rejects when an in-flight desktop command is aborted', async () => {
    let calls = 0
    let markStarted: (() => void) | null = null
    let resolvePendingResponse: ((value: ProxyHttpResponse) => void) | null = null
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    await mockTauriIPC(() => {
      calls += 1
      const resolve = markStarted
      if (!resolve) throw new Error('Expected start resolver to be installed')
      resolve()
      return new Promise<ProxyHttpResponse>((pendingResolve) => {
        resolvePendingResponse = pendingResolve
      })
    })
    const controller = new AbortController()

    const request = tauriFetch('https://example.test/slow', { signal: controller.signal })
    await started
    controller.abort()

    await expect(request).rejects.toHaveProperty('name', 'AbortError')
    expect(calls).toBe(1)
    expect(resolvePendingResponse).toBeTypeOf('function')
  })
})

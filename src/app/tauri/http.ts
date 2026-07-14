export interface ProxyHttpHeader {
  name: string
  value: string
}

export interface ProxyHttpRequest {
  url: string
  method?: string
  headers?: ProxyHttpHeader[]
  body?: Uint8Array
  timeoutMs?: number
}

export interface ProxyHttpResponse {
  status: number
  headers: ProxyHttpHeader[]
  body: number[]
}

const NULL_BODY_STATUS_CODES = new Set([204, 205, 304])

function responseBodyForStatus(response: ProxyHttpResponse): BodyInit | null {
  if (NULL_BODY_STATUS_CODES.has(response.status)) return null
  return Uint8Array.from(response.body)
}

function headersToProxyHeaders(headers: Headers): ProxyHttpHeader[] {
  return [...headers.entries()].map(([name, value]) => ({ name, value }))
}

async function requestBodyToBytes(request: Request): Promise<Uint8Array | undefined> {
  if (!request.body) return undefined
  return new Uint8Array(await request.arrayBuffer())
}

export interface TauriFetchOptions {
  timeoutMs?: number
}

function abortError(reason?: unknown): Error | DOMException {
  if (reason instanceof Error) return reason
  if (typeof DOMException !== 'undefined' && reason instanceof DOMException) return reason
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError(signal.reason)
}

async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let cleanup: (() => void) | undefined
  const abort = new Promise<never>((_, reject) => {
    const onAbort = () => reject(abortError(signal.reason))
    cleanup = () => signal.removeEventListener('abort', onAbort)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([promise, abort])
  } finally {
    cleanup?.()
  }
}

export function createTauriFetch(options: TauriFetchOptions = {}): typeof fetch {
  return (input, init) => tauriFetch(input, init, options)
}

export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: TauriFetchOptions = {}
): Promise<Response> {
  const request = new Request(input, init)
  throwIfAborted(request.signal)
  const { invoke } = await import('@tauri-apps/api/core')
  throwIfAborted(request.signal)
  const payload: ProxyHttpRequest = {
    url: request.url,
    method: request.method,
    headers: headersToProxyHeaders(request.headers),
    body: await requestBodyToBytes(request),
    timeoutMs: options.timeoutMs
  }
  throwIfAborted(request.signal)
  const response = await raceWithAbort(
    invoke<ProxyHttpResponse>('proxy_http_request', { request: payload }),
    request.signal
  )
  return new Response(responseBodyForStatus(response), {
    status: response.status,
    headers: response.headers.map(({ name, value }): [string, string] => [name, value])
  })
}

import { Channel, invoke } from '@tauri-apps/api/core'

import { randomHex } from '@open-pencil/scene-graph/random'

import type { FetchFunction } from '@/app/http/types'

export interface ProxyHttpHeader {
  name: string
  value: string
}

export interface ProxyHttpRequest {
  /** Chosen here so the request can be cancelled before its head arrives. */
  id: string
  url: string
  method?: string
  headers?: ProxyHttpHeader[]
  body?: number[]
  max_response_bytes?: number
  follow_redirects?: boolean
  timeout_ms?: number
}

/** Status and headers; the body streams over the request's channel. */
export interface ProxyHttpHead {
  status: number
  headers: ProxyHttpHeader[]
  url: string
}

/** `network` marks failures to reach the server or read from it. */
export interface ProxyHttpError {
  network: boolean
  message: string
}

/** Body chunks arrive as raw bytes, then one of these ends the body. */
export type ProxyHttpBodyMessage = ArrayBuffer | { done: true } | { error: ProxyHttpError }

const NULL_BODY_STATUS_CODES = new Set([204, 205, 304])

function isProxyHttpError(error: unknown): error is ProxyHttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'network' in error &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

/**
 * Fails the way `fetch` does: a network failure is a `TypeError('fetch failed')` whose cause
 * names it, which the AI SDK and other callers recognise and retry.
 */
function fetchError(error: unknown): Error {
  if (error instanceof Error) return error
  if (!isProxyHttpError(error)) return new TypeError('fetch failed', { cause: error })
  if (error.network) return new TypeError('fetch failed', { cause: new Error(error.message) })
  return new TypeError(error.message)
}

function headersToProxyHeaders(headers: Headers): ProxyHttpHeader[] {
  return [...headers.entries()].map(([name, value]) => ({ name, value }))
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError')
}

export function withAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(abortReason(signal))
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void (async () => {
      try {
        const value = await promise
        cleanup()
        resolve(value)
      } catch (error) {
        cleanup()
        reject(
          error instanceof Error
            ? error
            : new Error('Desktop HTTP request failed', { cause: error })
        )
      }
    })()
  })
}

export interface TauriFetchOptions {
  timeoutMs?: number
  maxResponseBytes?: number
  nativeFetch?: FetchFunction
}

const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis)

export function createTauriFetch(options: TauriFetchOptions = {}): FetchFunction {
  return (input, init) =>
    executeTauriFetch(
      options.nativeFetch ?? nativeFetch,
      input,
      init,
      options.maxResponseBytes,
      options.timeoutMs
    )
}

export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxResponseBytes?: number,
  timeoutMs?: number
): Promise<Response> {
  return executeTauriFetch(nativeFetch, input, init, maxResponseBytes, timeoutMs)
}

async function executeTauriFetch(
  fetcher: FetchFunction,
  input: RequestInfo | URL,
  init?: RequestInit,
  maxResponseBytes?: number,
  timeoutMs?: number
): Promise<Response> {
  const parsedURL = new URL(input instanceof Request ? input.url : input.toString())
  const isIpcURL =
    parsedURL.protocol === 'ipc:' ||
    ((parsedURL.protocol === 'http:' || parsedURL.protocol === 'https:') &&
      parsedURL.hostname === 'ipc.localhost')
  if (isIpcURL) {
    return fetcher(input, init)
  }

  const request = new Request(input, init)
  request.signal.throwIfAborted()
  request.signal.throwIfAborted()

  // Capture generated multipart headers before consuming the Request body.
  const headers = headersToProxyHeaders(request.headers)
  let bodyData: Uint8Array | undefined
  if (request.body != null) {
    const buffer = await request.arrayBuffer()
    request.signal.throwIfAborted()
    bodyData = new Uint8Array(buffer)
  }

  const id = randomHex()
  let finished = false
  const cancel = () => {
    if (finished) return
    finished = true
    request.signal.removeEventListener('abort', onAbort)
    void invoke('cancel_http_request', { id }).catch(() => undefined)
  }
  const finish = () => {
    finished = true
    request.signal.removeEventListener('abort', onAbort)
  }

  // Set by the body stream's start(), which runs synchronously in its constructor.
  let abortBody: ((reason: Error) => void) | undefined
  const onBody = new Channel<ProxyHttpBodyMessage>()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      onBody.onmessage = (message) => {
        if (finished) return
        if (message instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(message))
        } else if ('error' in message) {
          finish()
          controller.error(fetchError(message.error))
        } else {
          finish()
          controller.close()
        }
      }
      abortBody = (reason) => {
        cancel()
        controller.error(reason)
      }
    },
    cancel
  })
  function onAbort() {
    abortBody?.(abortReason(request.signal))
  }
  request.signal.addEventListener('abort', onAbort, { once: true })

  const payload: ProxyHttpRequest = {
    id,
    url: request.url,
    method: request.method,
    headers,
    body: bodyData ? Array.from(bodyData) : undefined,
    max_response_bytes: maxResponseBytes,
    follow_redirects: request.redirect === 'follow',
    timeout_ms: timeoutMs
  }
  let head: ProxyHttpHead
  try {
    head = await withAbortSignal(
      invoke<ProxyHttpHead>('proxy_http_request', { request: payload, onBody }).catch(
        (error: unknown) => {
          throw fetchError(error)
        }
      ),
      request.signal
    )
  } catch (error) {
    if (request.signal.aborted) cancel()
    else finish()
    throw error
  }

  const proxiedResponse = new Response(NULL_BODY_STATUS_CODES.has(head.status) ? null : body, {
    status: head.status,
    headers: head.headers.map(({ name, value }): [string, string] => [name, value])
  })
  Object.defineProperty(proxiedResponse, 'url', { value: head.url })
  return proxiedResponse
}

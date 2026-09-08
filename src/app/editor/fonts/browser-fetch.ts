import type { FetchFunction } from '@/app/http/types'
import { IS_BROWSER } from '@/constants'

const MAX_WEB_FONT_RESPONSE_BYTES = 8 * 1024 * 1024
const ALLOWED_WEB_FONT_HOSTS = new Set([
  'api.fontsource.org',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.google.com',
  'fonts.gstatic.com'
])

export function createBrowserWebFontFetch(
  nativeFetch: typeof globalThis.fetch,
  origin = ''
): FetchFunction {
  return async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin === origin) return nativeFetch(request)
    if (url.protocol !== 'https:' || !ALLOWED_WEB_FONT_HOSTS.has(url.hostname)) {
      throw new Error(`Unsupported web font host: ${url.hostname}`)
    }

    const response = await nativeFetch(request)
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_WEB_FONT_RESPONSE_BYTES) {
      throw new Error('Web font response exceeds the size limit')
    }
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_WEB_FONT_RESPONSE_BYTES) {
      throw new Error('Web font response exceeds the size limit')
    }
    const bounded = new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
    Object.defineProperty(bounded, 'url', { value: response.url })
    return bounded
  }
}

export const browserWebFontFetch = createBrowserWebFontFetch(
  globalThis.fetch.bind(globalThis),
  IS_BROWSER ? window.location.origin : ''
)

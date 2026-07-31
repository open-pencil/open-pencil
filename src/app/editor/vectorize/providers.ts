import { encodeBase64 } from '@open-pencil/core/bytes'
import { IS_TAURI } from '@open-pencil/core/constants'

import { tauriFetch } from '@/app/tauri/http'

import {
  VectorizeAuthError,
  type VectorizeProvider,
  type VectorizeProviderDefinition,
  type VectorizeProviderID,
  VectorizeTimeoutError
} from './types'

const REQUEST_TIMEOUT_MS = 30_000
const NATIVE_TIMEOUT_GRACE_MS = 1000
const MAX_SVG_BYTES = 20 * 1024 * 1024
const MAX_API_RESPONSE_BYTES = 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const RECRAFT_DEFINITION = {
  id: 'recraft',
  name: 'Recraft',
  keyURL: 'https://www.recraft.ai/profile/api',
  keyPlaceholder: 'Recraft API key'
} satisfies VectorizeProviderDefinition

const FAL_DEFINITION = {
  id: 'fal',
  name: 'fal.ai',
  keyURL: 'https://fal.ai/dashboard/keys',
  keyPlaceholder: 'fal API key'
} satisfies VectorizeProviderDefinition

export const VECTORIZE_PROVIDER_DEFINITIONS: readonly VectorizeProviderDefinition[] = [
  RECRAFT_DEFINITION,
  FAL_DEFINITION
]

async function vectorizeFetch(
  input: string,
  init?: RequestInit,
  maxResponseBytes = MAX_API_RESPONSE_BYTES
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const requestInit = { ...init, signal: controller.signal }
    return await (IS_TAURI
      ? tauriFetch(
          input,
          requestInit,
          maxResponseBytes,
          REQUEST_TIMEOUT_MS + NATIVE_TIMEOUT_GRACE_MS
        )
      : fetch(input, requestInit))
  } catch (error) {
    if (controller.signal.aborted) throw new VectorizeTimeoutError()
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

type VectorizeResponseRecord = {
  image?: unknown
  data?: unknown
  images?: unknown
  url?: unknown
}

function isVectorizeResponseRecord(value: unknown): value is VectorizeResponseRecord {
  return typeof value === 'object' && value !== null
}

function readURLField(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('url' in value)) return null
  return typeof value.url === 'string' && value.url ? value.url : null
}

export function extractVectorizedSVGURL(payload: unknown): string | null {
  if (!isVectorizeResponseRecord(payload)) return null
  const record = payload
  if ('image' in record) {
    const imageURL = readURLField(record.image)
    if (imageURL) return imageURL
  }
  for (const field of ['data', 'images'] as const) {
    if (!(field in record)) continue
    const value = record[field]
    if (Array.isArray(value) && value.length > 0) {
      const itemURL = readURLField(value[0])
      if (itemURL) return itemURL
    }
    const nestedURL = extractVectorizedSVGURL(value)
    if (nestedURL) return nestedURL
  }
  return readURLField(record)
}

function isAllowedAssetHost(providerID: VectorizeProviderID, hostname: string): boolean {
  const suffixes = providerID === 'recraft' ? ['recraft.ai'] : ['fal.media', 'fal.run', 'fal.ai']
  return suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

export function validateVectorizedAssetURL(providerID: VectorizeProviderID, rawURL: string): URL {
  const url = new URL(rawURL)
  if (url.protocol !== 'https:' || !isAllowedAssetHost(providerID, url.hostname.toLowerCase())) {
    throw new Error('Vectorization provider returned an untrusted download URL')
  }
  return url
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
  sizeError: string
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(sizeError)
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new Error(sizeError)
    return new TextDecoder().decode(bytes)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    let result = await reader.read()
    while (!result.done) {
      totalBytes += result.value.byteLength
      if (totalBytes > maxBytes) throw new Error(sizeError)
      chunks.push(result.value)
      result = await reader.read()
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function fetchSVGFromURL(providerID: VectorizeProviderID, rawURL: string): Promise<string> {
  const url = validateVectorizedAssetURL(providerID, rawURL)
  let response: Response
  try {
    response = await vectorizeFetch(
      url.href,
      { credentials: 'omit', redirect: 'error' },
      MAX_SVG_BYTES
    )
  } catch (error) {
    if (error instanceof VectorizeTimeoutError) throw error
    throw new Error('Vectorized SVG could not be downloaded. Try again or use the desktop app.')
  }
  if (!response.ok) throw new Error(`Failed to download vectorized SVG (${response.status})`)
  if (response.url) validateVectorizedAssetURL(providerID, response.url)
  return readBoundedResponse(response, MAX_SVG_BYTES, 'Vectorized SVG is too large')
}

async function responseErrorDetail(response: Response): Promise<string> {
  const detail = await readBoundedResponse(
    response,
    4096,
    'Provider error response is too large'
  ).catch(() => '')
  return detail.trim().slice(0, 500)
}

const recraft: VectorizeProvider = {
  ...RECRAFT_DEFINITION,
  async vectorize(pngBytes, apiKey) {
    if (pngBytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large to vectorize')
    const form = new FormData()
    const payload = pngBytes.buffer.slice(
      pngBytes.byteOffset,
      pngBytes.byteOffset + pngBytes.byteLength
    ) as ArrayBuffer
    form.append('file', new Blob([payload], { type: 'image/png' }), 'image.png')

    const response = await vectorizeFetch('https://external.api.recraft.ai/v1/images/vectorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      credentials: 'omit',
      redirect: 'error'
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError(recraft.name)
      }
      const detail = await responseErrorDetail(response)
      throw new Error(
        detail
          ? `${recraft.name} vectorization failed (${response.status}): ${detail}`
          : `${recraft.name} vectorization failed (${response.status})`
      )
    }
    const url = extractVectorizedSVGURL(
      JSON.parse(
        await readBoundedResponse(
          response,
          MAX_API_RESPONSE_BYTES,
          `${recraft.name} response is too large`
        )
      )
    )
    if (!url) throw new Error(`${recraft.name} returned no SVG URL`)
    return fetchSVGFromURL(recraft.id, url)
  }
}

const fal: VectorizeProvider = {
  ...FAL_DEFINITION,
  async vectorize(pngBytes, apiKey) {
    if (pngBytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large to vectorize')
    const response = await vectorizeFetch('https://fal.run/fal-ai/recraft/vectorize', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_url: `data:image/png;base64,${encodeBase64(pngBytes)}` }),
      credentials: 'omit',
      redirect: 'error'
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError(fal.name)
      }
      const detail = await responseErrorDetail(response)
      throw new Error(
        detail
          ? `${fal.name} vectorization failed (${response.status}): ${detail}`
          : `${fal.name} vectorization failed (${response.status})`
      )
    }
    const url = extractVectorizedSVGURL(
      JSON.parse(
        await readBoundedResponse(
          response,
          MAX_API_RESPONSE_BYTES,
          `${fal.name} response is too large`
        )
      )
    )
    if (!url) throw new Error(`${fal.name} returned no SVG URL`)
    return fetchSVGFromURL(fal.id, url)
  }
}

const providers: Record<VectorizeProviderID, VectorizeProvider> = { recraft, fal }

export function getVectorizeProvider(providerID: VectorizeProviderID): VectorizeProvider {
  return providers[providerID]
}

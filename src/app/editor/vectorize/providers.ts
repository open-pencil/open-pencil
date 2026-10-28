import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import { IS_TAURI } from '@open-pencil/core/constants'

import { readBoundedBody } from '@/app/document/io/browser'
import { tauriFetch } from '@/app/tauri/http'

import {
  VectorizeAuthError,
  type VectorizeProvider,
  type VectorizeProviderDefinition,
  type VectorizeProviderID,
  VectorizeTimeoutError
} from './types'

const REQUEST_TIMEOUT_MS = 30_000
/** Arrow writes the SVG token by token, so a detailed image takes it minutes, not seconds. */
const QUIVER_TIMEOUT_MS = 180_000
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

const QUIVER_DEFINITION = {
  id: 'quiver',
  name: 'QuiverAI',
  keyURL: 'https://platform.quiver.ai/api-keys',
  keyPlaceholder: 'QuiverAI API key'
} satisfies VectorizeProviderDefinition

export const VECTORIZE_PROVIDER_DEFINITIONS: readonly VectorizeProviderDefinition[] = [
  RECRAFT_DEFINITION,
  FAL_DEFINITION,
  QUIVER_DEFINITION
]

/** An answer read in full: the body of a success, or the start of a failure's for its message. */
interface VectorizeResponse {
  ok: boolean
  status: number
  url: string
  text: string
}

/** How much of a failure's body its message quotes. */
const ERROR_DETAIL_BYTES = 4096
const ERROR_DETAIL_CHARS = 500

/**
 * Sends a request and reads its answer under one deadline. A browser's fetch resolves on the
 * headers, so a service that stalls in the body would otherwise hold the layer's vectorization
 * open with no timeout left.
 */
async function vectorizeFetch(
  input: string,
  init: RequestInit,
  {
    maxResponseBytes = MAX_API_RESPONSE_BYTES,
    timeoutMs = REQUEST_TIMEOUT_MS,
    sizeError = 'Vectorization response is too large'
  }: { maxResponseBytes?: number; timeoutMs?: number; sizeError?: string } = {}
): Promise<VectorizeResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const requestInit = { ...init, signal: controller.signal }
    const response = await (IS_TAURI
      ? tauriFetch(input, requestInit, maxResponseBytes, timeoutMs + NATIVE_TIMEOUT_GRACE_MS)
      : fetch(input, requestInit))
    const text = response.ok
      ? await readBoundedResponse(response, maxResponseBytes, sizeError)
      : await readBoundedResponse(response, ERROR_DETAIL_BYTES, sizeError).then(
          (detail) => detail.trim().slice(0, ERROR_DETAIL_CHARS),
          () => ''
        )
    if (controller.signal.aborted) throw new VectorizeTimeoutError()
    return { ok: response.ok, status: response.status, url: response.url, text }
  } catch (error) {
    if (controller.signal.aborted) throw new VectorizeTimeoutError()
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function providerFailure(name: string, response: VectorizeResponse): Error {
  return new Error(
    response.text
      ? `${name} vectorization failed (${response.status}): ${response.text}`
      : `${name} vectorization failed (${response.status})`
  )
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

/** Where each service serves the SVGs it links to; Quiver returns its SVG inline. */
const ASSET_HOSTS: Record<VectorizeProviderID, readonly string[]> = {
  recraft: ['recraft.ai'],
  fal: ['fal.media', 'fal.run', 'fal.ai'],
  quiver: []
}

function isAllowedAssetHost(providerID: VectorizeProviderID, hostname: string): boolean {
  const suffixes = ASSET_HOSTS[providerID]
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
  const bytes = await readBoundedBody(response, maxBytes, { sizeError })
  return new TextDecoder().decode(bytes)
}

async function fetchSVGFromURL(providerID: VectorizeProviderID, rawURL: string): Promise<string> {
  const url = validateVectorizedAssetURL(providerID, rawURL)
  let response: VectorizeResponse
  try {
    response = await vectorizeFetch(
      url.href,
      { credentials: 'omit', redirect: 'error' },
      { maxResponseBytes: MAX_SVG_BYTES, sizeError: 'Vectorized SVG is too large' }
    )
  } catch (error) {
    if (error instanceof VectorizeTimeoutError) throw error
    if (error instanceof Error && error.message === 'Vectorized SVG is too large') throw error
    throw new Error('Vectorized SVG could not be downloaded. Try again or use the desktop app.')
  }
  if (!response.ok) throw new Error(`Failed to download vectorized SVG (${response.status})`)
  if (response.url) validateVectorizedAssetURL(providerID, response.url)
  return response.text
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

    const response = await vectorizeFetch(
      'https://external.api.recraft.ai/v1/images/vectorize',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        credentials: 'omit',
        redirect: 'error'
      },
      { sizeError: `${recraft.name} response is too large` }
    )
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError(recraft.name)
      }
      throw providerFailure(recraft.name, response)
    }
    const url = extractVectorizedSVGURL(JSON.parse(response.text))
    if (!url) throw new Error(`${recraft.name} returned no SVG URL`)
    return fetchSVGFromURL(recraft.id, url)
  }
}

const fal: VectorizeProvider = {
  ...FAL_DEFINITION,
  async vectorize(pngBytes, apiKey) {
    if (pngBytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large to vectorize')
    const response = await vectorizeFetch(
      'https://fal.run/fal-ai/recraft/vectorize',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: `data:image/png;base64,${fromUint8Array(pngBytes)}` }),
        credentials: 'omit',
        redirect: 'error'
      },
      { sizeError: `${fal.name} response is too large` }
    )
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError(fal.name)
      }
      throw providerFailure(fal.name, response)
    }
    const url = extractVectorizedSVGURL(JSON.parse(response.text))
    if (!url) throw new Error(`${fal.name} returned no SVG URL`)
    return fetchSVGFromURL(fal.id, url)
  }
}

/** Quiver's Image to SVG answer, which carries the SVG markup itself rather than a link to it. */
const quiverResponseSchema = v.object({
  data: v.pipe(v.array(v.object({ svg: v.pipe(v.string(), v.minLength(1)) })), v.minLength(1))
})

const quiver: VectorizeProvider = {
  ...QUIVER_DEFINITION,
  async vectorize(pngBytes, apiKey) {
    if (pngBytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large to vectorize')
    const response = await vectorizeFetch(
      'https://api.quiver.ai/v1/svgs/vectorizations',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'arrow-2',
          image: { base64: fromUint8Array(pngBytes) },
          stream: false
        }),
        credentials: 'omit',
        redirect: 'error'
      },
      {
        maxResponseBytes: MAX_SVG_BYTES,
        timeoutMs: QUIVER_TIMEOUT_MS,
        sizeError: `${quiver.name} response is too large`
      }
    )
    if (!response.ok) {
      // Quiver answers 403 for a frozen account or a refused request, never for the key.
      if (response.status === 401) throw new VectorizeAuthError(quiver.name)
      throw providerFailure(quiver.name, response)
    }
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), quiverResponseSchema),
      response.text
    )
    if (!parsed.success) throw new Error(`${quiver.name} returned no SVG`)
    return parsed.output.data[0].svg
  }
}

const providers: Record<VectorizeProviderID, VectorizeProvider> = { recraft, fal, quiver }

export function getVectorizeProvider(providerID: VectorizeProviderID): VectorizeProvider {
  return providers[providerID]
}

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

async function vectorizeFetch(
  input: string,
  init?: RequestInit,
  maxResponseBytes = MAX_API_RESPONSE_BYTES,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const requestInit = { ...init, signal: controller.signal }
    return await (IS_TAURI
      ? tauriFetch(input, requestInit, maxResponseBytes, timeoutMs + NATIVE_TIMEOUT_GRACE_MS)
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
      body: JSON.stringify({ image_url: `data:image/png;base64,${fromUint8Array(pngBytes)}` }),
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
      MAX_SVG_BYTES,
      QUIVER_TIMEOUT_MS
    )
    if (!response.ok) {
      // Quiver answers 403 for a frozen account or a refused request, never for the key.
      if (response.status === 401) throw new VectorizeAuthError(quiver.name)
      const detail = await responseErrorDetail(response)
      throw new Error(
        detail
          ? `${quiver.name} vectorization failed (${response.status}): ${detail}`
          : `${quiver.name} vectorization failed (${response.status})`
      )
    }
    const text = await readBoundedResponse(
      response,
      MAX_SVG_BYTES,
      `${quiver.name} response is too large`
    )
    const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), quiverResponseSchema), text)
    if (!parsed.success) throw new Error(`${quiver.name} returned no SVG`)
    return parsed.output.data[0].svg
  }
}

const providers: Record<VectorizeProviderID, VectorizeProvider> = { recraft, fal, quiver }

export function getVectorizeProvider(providerID: VectorizeProviderID): VectorizeProvider {
  return providers[providerID]
}

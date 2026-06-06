/**
 * Vectorize provider registry. Each provider implements a common interface so the
 * editor action can call the selected one without branching on its id. Both current
 * providers run the same Recraft raster→SVG engine (see RECRAFT-API.md):
 *   - Recraft: POST external.api.recraft.ai/v1/images/vectorize (multipart `file`)
 *   - fal:     POST fal.run/fal-ai/recraft/vectorize (JSON `image_url`)
 */
import { VECTORIZE_PROVIDER_LABELS, type VectorizeProviderId } from '@/app/ai/chat/storage'

export interface VectorizeProvider {
  id: VectorizeProviderId
  label: string
  /** Convert PNG bytes into an SVG document string via the provider's API. */
  vectorize(pngBytes: Uint8Array, apiKey: string): Promise<string>
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function fetchSVGFromURL(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, { mode: 'cors' })
  } catch {
    throw new Error(
      'Vectorized SVG could not be downloaded (blocked by browser). Try again or use the desktop app.'
    )
  }
  if (!response.ok) {
    throw new Error(`Failed to download vectorized SVG (${response.status})`)
  }
  return response.text()
}

function readURLField(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if (!('url' in value)) return null
  const url = value.url
  return typeof url === 'string' && url.length > 0 ? url : null
}

function extractSVGURL(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const fromImage = 'image' in payload ? readURLField(payload.image) : null
  if (fromImage) return fromImage

  if ('data' in payload && Array.isArray(payload.data) && payload.data.length > 0) {
    const fromData = readURLField(payload.data[0])
    if (fromData) return fromData
  }

  if ('images' in payload && Array.isArray(payload.images) && payload.images.length > 0) {
    const fromImages = readURLField(payload.images[0])
    if (fromImages) return fromImages
  }

  if ('data' in payload) {
    const nested = extractSVGURL(payload.data)
    if (nested) return nested
  }

  return readURLField(payload)
}

const recraft: VectorizeProvider = {
  id: 'recraft',
  label: VECTORIZE_PROVIDER_LABELS.recraft,
  async vectorize(pngBytes, apiKey) {
    const form = new FormData()
    const blob = new Blob([toArrayBuffer(pngBytes)], { type: 'image/png' })
    form.append('file', blob, 'image.png')

    const response = await fetch('https://external.api.recraft.ai/v1/images/vectorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new Error('Recraft API key was rejected — check the key under Image vectorization')
      }
      throw new Error(
        detail
          ? `Recraft vectorize failed (${response.status}): ${detail}`
          : `Recraft vectorize failed (${response.status})`
      )
    }

    const payload = await response.json()
    const url = extractSVGURL(payload)
    if (!url) throw new Error('Recraft vectorize returned no image URL')
    return fetchSVGFromURL(url)
  }
}

const fal: VectorizeProvider = {
  id: 'fal',
  label: VECTORIZE_PROVIDER_LABELS.fal,
  async vectorize(pngBytes, apiKey) {
    const dataUri = `data:image/png;base64,${bytesToBase64(pngBytes)}`
    const response = await fetch('https://fal.run/fal-ai/recraft/vectorize', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_url: dataUri })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        detail
          ? `fal vectorize failed (${response.status}): ${detail}`
          : `fal vectorize failed (${response.status})`
      )
    }

    const payload = await response.json()
    const url = extractSVGURL(payload)
    if (!url) throw new Error('fal vectorize returned no image URL')
    return fetchSVGFromURL(url)
  }
}

export const VECTORIZE_PROVIDERS: Record<VectorizeProviderId, VectorizeProvider> = { recraft, fal }

export const DEFAULT_VECTORIZE_PROVIDER: VectorizeProviderId = 'recraft'

/** Resolve a provider by id, falling back to the default (Recraft). */
export function getVectorizeProvider(id: VectorizeProviderId): VectorizeProvider {
  return VECTORIZE_PROVIDERS[id] ?? VECTORIZE_PROVIDERS[DEFAULT_VECTORIZE_PROVIDER]
}

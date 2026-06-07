/**
 * Vectorize provider registry. Each provider implements a common interface so the
 * editor action can call the selected one without branching on its id. Both current
 * providers run the same Recraft raster→SVG engine (see RECRAFT-API.md):
 *   - Recraft: POST external.api.recraft.ai/v1/images/vectorize (multipart `file`)
 *   - fal:     POST fal.run/fal-ai/recraft/vectorize (JSON `image_url`)
 */
import { VECTORIZE_PROVIDER_LABELS, type VectorizeProviderId } from '@/app/ai/chat/storage'
import { IS_TAURI } from '@/constants'

// Bound every provider request so a hung connection can't leave a vectorization
// run stuck indefinitely (and blocking the next attempt).
const VECTORIZE_FETCH_TIMEOUT_MS = 30000

// In the desktop (Tauri) app the webview enforces CORS for cross-origin requests,
// which blocks the provider APIs that work fine from the browser. Route those calls
// through Tauri's HTTP plugin (a Rust-side request, not subject to CORS) on desktop,
// and fall back to the standard browser fetch on the web.
async function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VECTORIZE_FETCH_TIMEOUT_MS)
  try {
    const opts: RequestInit = { ...init, signal: controller.signal }
    if (IS_TAURI) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      return await tauriFetch(input, opts)
    }
    return await fetch(input, opts)
  } catch (error) {
    // Surface the timeout distinctly so it isn't masked as a CORS/network failure.
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VectorizeTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export interface VectorizeProvider {
  id: VectorizeProviderId
  label: string
  /** Convert PNG bytes into an SVG document string via the provider's API. */
  vectorize(pngBytes: Uint8Array, apiKey: string): Promise<string>
}

/** Thrown when a provider rejects the API key (401/403) so the UI can link to settings. */
export class VectorizeAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VectorizeAuthError'
  }
}

/** Thrown when a provider request exceeds VECTORIZE_FETCH_TIMEOUT_MS. */
export class VectorizeTimeoutError extends Error {
  constructor() {
    super('Vectorization request timed out')
    this.name = 'VectorizeTimeoutError'
  }
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
    response = await httpFetch(url, { mode: 'cors' })
  } catch (error) {
    if (error instanceof VectorizeTimeoutError) throw error
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

    const response = await httpFetch('https://external.api.recraft.ai/v1/images/vectorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError('Recraft API key was rejected')
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
    const response = await httpFetch('https://fal.run/fal-ai/recraft/vectorize', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_url: dataUri })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new VectorizeAuthError('fal API key was rejected')
      }
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

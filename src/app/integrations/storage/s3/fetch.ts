import { isTauri } from '@/app/tauri/env'

/** Avoid hung “Test connection” when CORS/network never resolves. */
const STORAGE_FETCH_TIMEOUT_MS = 20_000
/** Sustained uplink assumed for large bodies; below it, part retry — not a timeout — is the remedy. */
const STORAGE_FETCH_TIMEOUT_BYTES_PER_SECOND = 256 * 1024
const STORAGE_FETCH_TIMEOUT_MAX_MS = 5 * 60_000

/**
 * Fixed hang protection for small requests; large uploads get a body-sized
 * window on top. A fixed 20 s timeout killed 8 MB part PUTs on slow uplinks
 * (live B2 pass, 2026-08-04): the request was healthy, just not finished.
 */
export function storageFetchTimeoutForBody(byteLength: number | null | undefined): number {
  if (!byteLength) return STORAGE_FETCH_TIMEOUT_MS
  const transferMs = (byteLength / STORAGE_FETCH_TIMEOUT_BYTES_PER_SECOND) * 1000
  return Math.min(STORAGE_FETCH_TIMEOUT_MAX_MS, STORAGE_FETCH_TIMEOUT_MS + transferMs)
}

function withTimeoutSignal(
  timeoutMs: number,
  init?: RequestInit
): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const external = init?.signal
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  }
}

/** Prefer Tauri HTTP bridge on desktop to avoid bucket CORS requirements. */
export async function storageFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = STORAGE_FETCH_TIMEOUT_MS
): Promise<Response> {
  const { signal, cleanup } = withTimeoutSignal(timeoutMs, init)
  try {
    if (isTauri()) {
      const { tauriFetch } = await import('@/app/tauri/http')
      return await tauriFetch(input, { ...init, signal })
    }
    // Never from the HTTP cache. Every key here is mutable at a fixed URL, so a
    // cached response is the wrong content rather than an old copy of the right
    // content — a bucket or CDN that sends a long `max-age` would hide a
    // document's own updates behind the version we happened to read first.
    // Request bodies are owned by the Request; re-wrap so we can attach a timeout signal.
    if (input instanceof Request) {
      return await fetch(new Request(input, { signal, cache: 'no-store' }))
    }
    return await fetch(input, { ...init, signal, cache: 'no-store' })
  } catch (error) {
    if (signal.aborted) {
      throw new Error(
        'Storage request timed out. Check the endpoint URL, network, and bucket CORS settings.'
      )
    }
    throw error
  } finally {
    cleanup()
  }
}

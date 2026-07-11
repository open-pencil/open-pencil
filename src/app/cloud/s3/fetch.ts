import { isTauri } from '@/app/tauri/env'

/** Avoid hung “Test connection” when CORS/network never resolves. */
const CLOUD_FETCH_TIMEOUT_MS = 20_000

function withTimeoutSignal(init?: RequestInit): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLOUD_FETCH_TIMEOUT_MS)
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
export async function cloudFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { signal, cleanup } = withTimeoutSignal(init)
  try {
    if (isTauri()) {
      const { tauriFetch } = await import('@/app/tauri/http')
      return await tauriFetch(input, { ...init, signal })
    }
    // Request bodies are owned by the Request; re-wrap so we can attach a timeout signal.
    if (input instanceof Request) {
      return await fetch(new Request(input, { signal }))
    }
    return await fetch(input, { ...init, signal })
  } catch (error) {
    if (signal.aborted) {
      throw new Error(
        'Cloud request timed out. Check the endpoint URL, network, and bucket CORS settings.'
      )
    }
    throw error
  } finally {
    cleanup()
  }
}

import { isTauri } from '@/app/tauri/env'

/** Avoid hung “Test connection” when CORS/network never resolves. */
const STORAGE_FETCH_TIMEOUT_MS = 20_000

interface StorageFetchSignal {
  signal: AbortSignal
  timedOut: () => boolean
}

function storageFetchSignal(external?: AbortSignal | null): StorageFetchSignal {
  const timeout = AbortSignal.timeout(STORAGE_FETCH_TIMEOUT_MS)
  return {
    signal: external ? AbortSignal.any([external, timeout]) : timeout,
    timedOut: () => timeout.aborted
  }
}

/** Prefer Tauri HTTP bridge on desktop to avoid bucket CORS requirements. */
export async function storageFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const { signal, timedOut } = storageFetchSignal(
    init?.signal ?? (input instanceof Request ? input.signal : null)
  )
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
    if (timedOut()) {
      throw new Error(
        'Storage request timed out. Check the endpoint URL, network, and bucket CORS settings.'
      )
    }
    throw error
  }
}

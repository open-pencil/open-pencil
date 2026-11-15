import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

/**
 * How long a request waits for its answer, or a download for its next bytes, before it fails, so a
 * “Test connection” whose CORS or network never answers does not hang. A slow transfer that keeps
 * moving goes on however long it takes.
 */
const STORAGE_STALL_TIMEOUT_MS = 20_000

function timedOut(): Error {
  return new Error(
    'Storage request timed out. Check the endpoint URL, network, and bucket CORS settings.'
  )
}

/** Fails a request once nothing arrives for `stallTimeoutMs`, from when it restarts. */
function stallWatch(external: AbortSignal | null, stallTimeoutMs: number) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => clearTimeout(timer)
  return {
    signal: external ? AbortSignal.any([external, controller.signal]) : controller.signal,
    restart() {
      stop()
      timer = setTimeout(() => controller.abort(timedOut()), stallTimeoutMs)
    },
    stop,
    timedOut: () => controller.signal.aborted
  }
}

type StallWatch = ReturnType<typeof stallWatch>

/** The response with its body watched: each piece that arrives gives the next one more time. */
function watchBody(response: Response, watch: StallWatch): Response {
  if (!response.body) {
    watch.stop()
    return response
  }
  watch.restart()
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      // Fails the body itself, whether or not the fetch stops its own on the abort.
      start(controller) {
        watch.signal.addEventListener('abort', () => controller.error(watch.signal.reason), {
          once: true
        })
      },
      transform(chunk, controller) {
        watch.restart()
        controller.enqueue(chunk)
      },
      flush: watch.stop
    })
  )
  const watched = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
  Object.defineProperty(watched, 'url', { value: response.url })
  return watched
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/**
 * The AWS SDK types a custom fetch as the global `fetch`, which some runtimes extend with
 * static members (Bun adds `preconnect`). Copying the global's own members onto a replacement
 * keeps it assignable wherever the code is compiled; in a browser there are none to copy.
 */
export function asFetch(implementation: FetchImplementation): typeof fetch {
  return Object.assign(implementation, fetch)
}

/** Prefer Tauri HTTP bridge on desktop to avoid bucket CORS requirements. */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  stallTimeoutMs: number
): Promise<Response> {
  const watch = stallWatch(
    init?.signal ?? (input instanceof Request ? input.signal : null),
    stallTimeoutMs
  )
  const { signal } = watch
  // An upload shows no progress while its body goes out, so only cancelling it stops it.
  const uploads = init?.body != null || (input instanceof Request && input.body !== null)
  if (!uploads) watch.restart()
  let response: Response
  try {
    if (isTauri()) {
      response = await tauriFetch(input, { ...init, signal })
    } else if (input instanceof Request) {
      // Request bodies are owned by the Request; re-wrap so we can attach a timeout signal.
      response = await fetch(new Request(input, { signal }))
    } else {
      response = await fetch(input, { ...init, signal })
    }
  } catch (error) {
    watch.stop()
    if (watch.timedOut()) throw timedOut()
    throw error
  }
  return watchBody(response, watch)
}

/** Storage requests that fail once nothing arrives for `stallTimeoutMs`. */
export function createStorageFetch(stallTimeoutMs = STORAGE_STALL_TIMEOUT_MS): typeof fetch {
  return asFetch((input, init) => fetchWithTimeout(input, init, stallTimeoutMs))
}

export const storageFetch = createStorageFetch()

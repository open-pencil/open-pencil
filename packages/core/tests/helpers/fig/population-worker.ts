import type { FigGraphEdits } from '#core/kiwi/fig/population/edits'
import type {
  FigSessionPopulateRequest,
  FigSessionRequest,
  FigSessionResponse
} from '#core/kiwi/fig/session/protocol'

/**
 * A `Worker` that accepts messages and never answers. Session tests register it so the population
 * client reports a worker as available without starting a real worker thread.
 */
export function inertPopulationWorker(): Worker {
  return {
    terminate: () => undefined,
    postMessage: () => undefined,
    onerror: null,
    onmessage: null,
    onmessageerror: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true
  }
}

/**
 * A `Worker` whose page loads fail as a crashed worker's do, so the page loads on the main thread.
 * Edits it is sent are accepted.
 */
export function failingPopulationWorker(): Worker {
  const worker = inertPopulationWorker()
  worker.postMessage = (message: FigSessionRequest) => {
    if (message.type !== 'populate') return
    queueMicrotask(() => worker.onerror?.(new ErrorEvent('error')))
  }
  return worker
}

/**
 * The port a population client talks to a worker through, standing in for the worker: it keeps
 * the page loads and edits the client sends, and answers with `send`.
 */
export function populationPort() {
  const requests: FigSessionPopulateRequest[] = []
  const edits: FigGraphEdits[] = []
  let terminated = false
  const port = {
    onmessage: null as ((event: MessageEvent<FigSessionResponse>) => void) | null,
    start: () => undefined,
    close: () => undefined,
    postMessage(message: FigSessionRequest) {
      if (message.type === 'populate') requests.push(message)
      if (message.type === 'edits') edits.push(structuredClone(message.edits))
    }
  }
  const worker = {
    terminate: () => {
      terminated = true
    },
    postMessage: () => undefined,
    onerror: null,
    onmessage: null
  }
  return {
    port,
    worker,
    edits,
    /** The last page load requested. */
    request(): FigSessionPopulateRequest {
      const request = requests.at(-1)
      if (!request) throw new Error('No page load was requested')
      return request
    },
    send(data: FigSessionResponse) {
      port.onmessage?.(new MessageEvent<FigSessionResponse>('message', { data }))
    },
    terminated: () => terminated
  }
}

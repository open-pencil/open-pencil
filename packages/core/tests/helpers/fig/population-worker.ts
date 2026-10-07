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

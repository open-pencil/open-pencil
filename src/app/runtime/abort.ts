/** Why `signal` aborted, as an error: its reason, or an `AbortError` when the reason is none. */
export function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError')
}

/**
 * `promise`, or a rejection with the abort reason as soon as `signal` aborts. The work behind
 * the promise is not stopped; a rejection it settles with later is ignored.
 */
export function withAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(abortReason(signal))
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void (async () => {
      try {
        const value = await promise
        cleanup()
        resolve(value)
      } catch (error) {
        cleanup()
        reject(error instanceof Error ? error : new Error('The operation failed', { cause: error }))
      }
    })()
  })
}

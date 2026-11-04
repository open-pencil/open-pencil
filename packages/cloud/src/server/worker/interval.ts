/**
 * Waits `milliseconds`, or less if `signal` aborts first. One timer and one listener that is
 * removed again, so a long-lived signal doesn't collect a composite signal per wait.
 */
export async function waitForWorkerInterval(
  milliseconds: number,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  const stopped = new AbortController()
  await new Promise<void>((resolve) => {
    stopped.signal.addEventListener('abort', () => resolve(), { once: true })
    const timer = setTimeout(() => stopped.abort(), milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        stopped.abort()
      },
      { once: true, signal: stopped.signal }
    )
  })
}

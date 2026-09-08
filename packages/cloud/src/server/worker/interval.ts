export async function waitForWorkerInterval(
  milliseconds: number,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  await new Promise<void>((resolve) => {
    AbortSignal.any([signal, AbortSignal.timeout(milliseconds)]).addEventListener(
      'abort',
      () => resolve(),
      { once: true }
    )
  })
}

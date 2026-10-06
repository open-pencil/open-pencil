export async function measurePhase<T>(
  name: string,
  operation: () => Promise<T>,
  report: (message: string) => void = console.log
): Promise<T> {
  const started = performance.now()
  let outcome = 'failed'
  try {
    const result = await operation()
    outcome = 'completed'
    return result
  } finally {
    try {
      report(
        `[package-quality] ${name}: ${outcome} in ${((performance.now() - started) / 1000).toFixed(2)}s`
      )
      // oxlint-disable-next-line open-pencil/no-silent-catch -- Reporting must not change the phase outcome.
    } catch {}
  }
}

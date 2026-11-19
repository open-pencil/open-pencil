import type { JSHandle } from '@playwright/test'

/** In-page instrumentation: what it measured so far, and how to restore what it patched. */
export interface PageProbe<Reading> {
  read(): Reading
  dispose(): void
}

/**
 * Runs `run` with `probe` installed and returns its reading; restores what it patched and
 * releases the handle afterwards, whether `run` succeeded or not.
 */
export async function readProbe<Reading>(
  probe: JSHandle<PageProbe<Reading>>,
  run: () => Promise<void>
): Promise<Reading> {
  try {
    await run()
    return await probe.evaluate((installed) => installed.read())
  } finally {
    try {
      await probe.evaluate((installed) => installed.dispose())
    } finally {
      await probe.dispose()
    }
  }
}

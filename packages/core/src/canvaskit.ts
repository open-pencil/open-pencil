import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm/full'

import { IS_BROWSER } from './constants'
import { servesRuntimeAsset, unservedRuntimeAssetMessage } from './runtime-assets/served'

let instance: Promise<CanvasKit> | null = null

/** How long a failed load waits to learn whether its binary was served before giving up. */
const EXPLAIN_TIMEOUT_MS = 5000

/**
 * Maps a CanvasKit file name (`canvaskit.wasm`) to the URL it loads from. Mirrors the font
 * manager's bundled-font locator: under Node the file is read beside the package, since
 * CanvasKit's Node loader reads `file:` URLs itself; in a browser the default expects the host
 * to serve it at the site root, and a bundling host sets its emitted URL instead.
 */
export type CanvasKitLocator = (file: string) => string

export interface CanvasKitOptions {
  locateFile?: CanvasKitLocator
}

let locator: CanvasKitLocator = (file) =>
  IS_BROWSER ? `/${file}` : new URL(file, import.meta.resolve('canvaskit-wasm/full')).href

/** Points CanvasKit at the host's copy of its files. Call before the first {@link getCanvasKit}. */
export function setCanvasKitLocator(locate: CanvasKitLocator): void {
  locator = locate
}

/**
 * Why CanvasKit failed to load: when its binary is not served, an error naming the setup that
 * serves it, in place of the compile error the host's fallback page gave; otherwise the error.
 */
async function explainFailedLoad(url: string, error: unknown): Promise<unknown> {
  try {
    // Bounded, so a stalled request leaves the load failed rather than pending for every caller.
    const response = await fetch(url, { signal: AbortSignal.timeout(EXPLAIN_TIMEOUT_MS) })
    void response.body?.cancel()
    if (servesRuntimeAsset(response)) return error
    return new Error(
      unservedRuntimeAssetMessage('canvaskit.wasm', url, response, 'setCanvasKitLocator'),
      { cause: error }
    )
  } catch {
    return error
  }
}

/**
 * Loads CanvasKit once; callers that ask while it loads share the load, and a failed load is
 * retried. It is the full build, whose encoders write JPEG and WebP as well as PNG.
 */
export function getCanvasKit(options?: CanvasKitOptions): Promise<CanvasKit> {
  if (instance) return instance
  const locate = options?.locateFile ?? locator
  const loading = CanvasKitInit({ locateFile: locate }).catch(async (error: unknown) => {
    throw IS_BROWSER ? await explainFailedLoad(locate('canvaskit.wasm'), error) : error
  })
  instance = loading
  loading.catch(() => {
    if (instance === loading) instance = null
  })
  return loading
}

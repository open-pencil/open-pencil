import { decodePath } from 'ufo'

import CanvasKitInit, { type CanvasKit } from '@open-pencil/canvaskit'

import { IS_BROWSER } from './constants'
import { servesRuntimeAsset, unservedRuntimeAssetMessage } from './runtime-assets/served'

let instance: Promise<CanvasKit> | null = null

/** How long a failed load waits to learn whether its binary was served before giving up. */
const EXPLAIN_TIMEOUT_MS = 5000

/**
 * The filesystem path a `file:` URL names, with spaces and accents decoded. CanvasKit's Node
 * loader reads the located file with `fs`, so a URL-encoded path (`%20` for a space) names a
 * file that does not exist. A static `node:url` import is not an option here: this module also
 * ships to browsers, whose build leaves `node:` imports external. The leading slash before a
 * Windows drive letter is dropped, as `fileURLToPath` does, and a non-localhost host is kept
 * as a UNC prefix (`file://server/share/...` → `\\server\share\...`), since dropping it
 * would resolve the path on the current drive instead.
 */
export function filePathFromURL(url: URL): string {
  const path = decodePath(url.pathname)
  if (url.hostname && url.hostname !== 'localhost') {
    return `\\\\${url.hostname}${path.replaceAll('/', '\\')}`
  }
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
}

/**
 * Maps a CanvasKit file name (`canvaskit.wasm`) to where it loads from. Mirrors the font
 * manager's bundled-font locator: under Node the file is read beside the package as a
 * filesystem path, since CanvasKit's Node loader hands the located string to `fs`; in a
 * browser the default expects the host to serve it at the site root, and a bundling host
 * sets its emitted URL instead.
 */
export type CanvasKitLocator = (file: string) => string

export interface CanvasKitOptions {
  locateFile?: CanvasKitLocator
}

/** The default locator, exported so tests can check what Node is handed. */
export const defaultCanvasKitLocator: CanvasKitLocator = (file) =>
  IS_BROWSER
    ? `/${file}`
    : filePathFromURL(new URL(file, import.meta.resolve('@open-pencil/canvaskit')))

let locator: CanvasKitLocator = defaultCanvasKitLocator

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

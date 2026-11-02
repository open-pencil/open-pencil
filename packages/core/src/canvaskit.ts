import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm/full'

import { IS_BROWSER } from './constants'

let instance: Promise<CanvasKit> | null = null

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
 * Loads CanvasKit once; callers that ask while it loads share the load, and a failed load is
 * retried. It is the full build, whose encoders write JPEG and WebP as well as PNG.
 */
export function getCanvasKit(options?: CanvasKitOptions): Promise<CanvasKit> {
  if (instance) return instance
  const loading = CanvasKitInit({ locateFile: options?.locateFile ?? locator })
  instance = loading
  loading.catch(() => {
    if (instance === loading) instance = null
  })
  return loading
}

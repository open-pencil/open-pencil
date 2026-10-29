import canvasKitWasm from 'canvaskit-wasm/bin/canvaskit.wasm?url'

import { getCanvasKit, setCanvasKitLocator } from '@open-pencil/core/canvaskit'

/**
 * Importing CanvasKit's binary as an asset lets Vite serve it in development and emit a hashed
 * copy with the build, so no host keeps a second copy in `public/`. Kept apart from other
 * modules because `?url` imports only resolve in a Vite build, not in the Bun test runner.
 */
export function installCanvasKitBinary(): void {
  setCanvasKitLocator(() => canvasKitWasm)
}

/**
 * Starts loading CanvasKit as the app starts, so a document the app opens with does not wait for
 * the binary after its own download; the canvas shares this load. A failed one is retried there.
 */
export function preloadCanvasKit(): void {
  getCanvasKit().catch(() => undefined)
}

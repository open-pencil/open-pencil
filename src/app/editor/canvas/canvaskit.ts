// Points Core at the CanvasKit binary, bundled fonts, and HarfBuzz subsetter Vite serves;
// importing the module is what sets them, before anything loads.
import '@open-pencil/core/runtime-assets/install'
import { getCanvasKit } from '@open-pencil/core/canvaskit'

/**
 * Starts loading CanvasKit as the app starts, so a document the app opens with does not wait for
 * the binary after its own download; the canvas shares this load. A failed one is retried there.
 */
export function preloadCanvasKit(): void {
  getCanvasKit().catch(() => undefined)
}

// Points Core at the CanvasKit binary, bundled fonts, and HarfBuzz subsetter that the openPencil()
// Vite plugin serves; importing this module is what sets them, before anything loads.
import 'virtual:open-pencil/assets'
import { getCanvasKit } from '@open-pencil/core/canvaskit'

/**
 * Starts loading CanvasKit as the app starts, so a document the app opens with does not wait for
 * the binary after its own download; the canvas shares this load. A failed one is retried there.
 */
export function preloadCanvasKit(): void {
  getCanvasKit().catch(() => undefined)
}

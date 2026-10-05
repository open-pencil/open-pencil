import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { asDouble } from '#tests/helpers/doubles'

export { asDouble }

export function asCanvas(double: object): Canvas {
  return asDouble<Canvas>(double)
}

export function asCanvasKit(double: object): CanvasKit {
  return asDouble<CanvasKit>(double)
}

export function asRenderer(double: object): SkiaRenderer {
  return asDouble<SkiaRenderer>(double)
}

/**
 * `Image.readPixels` is typed for every colour type CanvasKit supports, so an 8-bit RGBA
 * read still widens to `Float32Array | Uint8Array | null`. Renderer tests always ask for
 * `RGBA_8888`; this narrows that result and fails the test when the surface returned
 * nothing or a float buffer instead.
 */
export function expectRgbaPixels(
  pixels: Float32Array | Uint8Array | null,
  label = 'pixels'
): Uint8Array {
  if (pixels == null) {
    throw new Error(`${label} were expected to be read back`)
  }
  if (!(pixels instanceof Uint8Array)) {
    throw new Error(`${label} were expected to be 8-bit RGBA data`)
  }
  return pixels
}

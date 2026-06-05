import type { CanvasKit } from 'canvaskit-wasm'

const MIN_DIMENSION = 256
const MAX_DIMENSION = 4096
const MAX_MEGAPIXELS = 16_000_000
const MAX_BYTES = 5 * 1024 * 1024

export type GetCanvasKit = () => CanvasKit | null

export interface PreprocessForVectorizeResult {
  pngBytes: Uint8Array
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}

function clampDimensions(width: number, height: number): { width: number; height: number } {
  let w = width
  let h = height
  const minDim = Math.min(w, h)
  if (minDim > 0 && minDim < MIN_DIMENSION) {
    const scale = MIN_DIMENSION / minDim
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const maxDim = Math.max(w, h)
  if (maxDim > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / maxDim
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  if (w * h > MAX_MEGAPIXELS) {
    const scale = Math.sqrt(MAX_MEGAPIXELS / (w * h))
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }

  return { width: w, height: h }
}

function encodePng(
  ck: CanvasKit,
  image: ReturnType<CanvasKit['MakeImageFromEncoded']>
): Uint8Array | null {
  if (!image) return null
  const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  return encoded ? new Uint8Array(encoded) : null
}

function resizeImage(
  ck: CanvasKit,
  source: NonNullable<ReturnType<CanvasKit['MakeImageFromEncoded']>>,
  width: number,
  height: number
): Uint8Array | null {
  const pixels = ck.Malloc(Uint8Array, width * height * 4)
  const surface = ck.MakeRasterDirectSurface(
    {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width,
      height
    },
    pixels,
    width * 4
  )
  if (!surface) {
    ck.Free(pixels)
    return null
  }
  const canvas = surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  const srcW = source.width()
  const srcH = source.height()
  canvas.drawImageRectOptions(
    source,
    ck.LTRBRect(0, 0, srcW, srcH),
    ck.LTRBRect(0, 0, width, height),
    ck.FilterMode.Linear,
    ck.MipmapMode.None,
    null
  )
  surface.flush()
  const snapshot = surface.makeImageSnapshot()
  const encoded = encodePng(ck, snapshot)
  snapshot.delete()
  surface.delete()
  ck.Free(pixels)
  return encoded
}

export function preprocessForVectorize(
  bytes: Uint8Array,
  getCk: GetCanvasKit
): PreprocessForVectorizeResult | null {
  const ck = getCk()
  if (!ck) return null

  const source = ck.MakeImageFromEncoded(bytes)
  if (!source) return null

  const originalWidth = source.width()
  const originalHeight = source.height()
  if (originalWidth <= 0 || originalHeight <= 0) {
    source.delete()
    return null
  }

  const target = clampDimensions(originalWidth, originalHeight)
  let pngBytes: Uint8Array | null
  if (target.width === originalWidth && target.height === originalHeight) {
    pngBytes = encodePng(ck, source)
  } else {
    pngBytes = resizeImage(ck, source, target.width, target.height)
  }
  source.delete()

  if (!pngBytes || pngBytes.length === 0) return null
  if (pngBytes.length > MAX_BYTES) return null

  return {
    pngBytes,
    originalWidth,
    originalHeight,
    width: target.width,
    height: target.height
  }
}

import type { CanvasKit, EncodedImageFormat } from 'canvaskit-wasm'

import type { ExportFormat, RasterExportFormat } from './render'

/** Unpremultiplied sRGB RGBA pixels, row-major with no padding. */
export interface RGBAImage {
  width: number
  height: number
  data: Uint8Array
}

/** Decode and encode raster images for pixel-level tools; backed by CanvasKit in app and CLI. */
export interface RasterCodec {
  decode(bytes: Uint8Array): RGBAImage | null
  encodePNG(image: RGBAImage): Uint8Array | null
  /** `image` as a JPEG, its alpha dropped onto black. */
  encodeJPG(image: RGBAImage): Uint8Array | null
}

export function createCanvasKitRasterCodec(ck: CanvasKit): RasterCodec {
  const info = (width: number, height: number) => ({
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width,
    height
  })

  const encode = (
    { width, height, data }: RGBAImage,
    format: EncodedImageFormat,
    quality: number
  ) => {
    const image = ck.MakeImage(info(width, height), data, width * 4)
    if (!image) return null
    try {
      const encoded = image.encodeToBytes(format, quality)
      return encoded ? new Uint8Array(encoded) : null
    } finally {
      image.delete()
    }
  }

  return {
    decode(bytes) {
      const image = ck.MakeImageFromEncoded(bytes)
      if (!image) return null
      try {
        const width = image.width()
        const height = image.height()
        const pixels = image.readPixels(0, 0, info(width, height))
        // RGBA_8888 always reads back as bytes.
        if (!(pixels instanceof Uint8Array)) return null
        return { width, height, data: pixels }
      } finally {
        image.delete()
      }
    },
    encodePNG: (image) => encode(image, ck.ImageFormat.PNG, 100),
    encodeJPG(image) {
      // JPEG ignores alpha; premultiplied colour is the colour laid over black.
      const source = ck.MakeImage(info(image.width, image.height), image.data, image.width * 4)
      if (!source) return null
      try {
        const overBlack = source.readPixels(0, 0, {
          ...info(image.width, image.height),
          alphaType: ck.AlphaType.Premul
        })
        if (!(overBlack instanceof Uint8Array)) return null
        return encode({ ...image, data: overBlack }, ck.ImageFormat.JPEG, 90)
      } finally {
        source.delete()
      }
    }
  }
}

export function ckImageFormat(ck: CanvasKit, format: ExportFormat) {
  switch (format) {
    case 'JPG':
      return ck.ImageFormat.JPEG
    case 'WEBP':
      return ck.ImageFormat.WEBP
    default:
      return ck.ImageFormat.PNG
  }
}

/** Encodes an encoded image, such as a PNG, again as `format`; null when CanvasKit cannot. */
export function reencodeImage(
  ck: CanvasKit,
  bytes: Uint8Array,
  format: RasterExportFormat,
  quality: number
): Uint8Array | null {
  const image = ck.MakeImageFromEncoded(bytes)
  if (!image) return null
  try {
    const encoded = image.encodeToBytes(ckImageFormat(ck, format), quality)
    return encoded ? new Uint8Array(encoded) : null
  } finally {
    image.delete()
  }
}

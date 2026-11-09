import type { ImagePreviewDecoder } from '@open-pencil/core/canvas'

/**
 * WebP keeps transparency at a fraction of PNG's size and encoding time for photos; browsers
 * that cannot encode it hand back PNG instead.
 */
const PREVIEW_ENCODING = { type: 'image/webp', quality: 0.9 } as const

/** The size a preview is drawn at, never above the source. */
export function previewSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(1, width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

function hasBytes(source: Uint8Array, offset: number, ...bytes: number[]): boolean {
  if (source.length < offset + bytes.length) return false
  return bytes.every((byte, index) => source[offset + index] === byte)
}

/** The image's type from its magic bytes, for the browser's scaled decoder. */
export function imageMimeType(source: Uint8Array): string | null {
  if (hasBytes(source, 0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (hasBytes(source, 0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (hasBytes(source, 0, 0x52, 0x49, 0x46, 0x46) && hasBytes(source, 8, 0x57, 0x45, 0x42, 0x50)) {
    return 'image/webp'
  }
  if (hasBytes(source, 0, 0x47, 0x49, 0x46)) return 'image/gif'
  if (
    hasBytes(source, 4, 0x66, 0x74, 0x79, 0x70) &&
    (hasBytes(source, 8, 0x61, 0x76, 0x69, 0x66) || hasBytes(source, 8, 0x61, 0x76, 0x69, 0x73))
  ) {
    return 'image/avif'
  }
  return null
}

const JPEG_APP1 = 0xe1
const EXIF_ORIENTATION_TAG = 0x0112

/** The Exif Orientation in an APP1 segment at `at`, or null when the segment is not Exif. */
function exifOrientation(
  source: Uint8Array,
  view: DataView,
  at: number,
  end: number
): number | null {
  const tiff = at + 10
  if (
    tiff + 8 > end ||
    !hasBytes(source, at + 4, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00) // "Exif\0\0"
  ) {
    return null
  }
  const littleEndian = source[tiff] === 0x49 && source[tiff + 1] === 0x49
  const bigEndian = source[tiff] === 0x4d && source[tiff + 1] === 0x4d
  if (!littleEndian && !bigEndian) return null
  const firstIFD = tiff + view.getUint32(tiff + 4, littleEndian)
  if (firstIFD + 2 > end) return 1
  const entries = view.getUint16(firstIFD, littleEndian)
  for (let entry = 0; entry < entries; entry++) {
    const offset = firstIFD + 2 + entry * 12
    if (offset + 12 > end) return 1
    if (view.getUint16(offset, littleEndian) === EXIF_ORIENTATION_TAG) {
      return view.getUint16(offset + 8, littleEndian)
    }
  }
  return 1
}

/**
 * The source's pixel size from its header, so a preview can ask the browser to decode at that
 * size instead of decoding the whole photo. A JPEG is read the way Exif says it is shown, so a
 * portrait photo stored sideways keeps its portrait shape. Null when the header is not one this
 * reads.
 */
export function imageDimensions(source: Uint8Array): { width: number; height: number } | null {
  const mime = imageMimeType(source)
  if (mime === 'image/jpeg') return jpegDimensions(source)
  if (mime === 'image/png') return pngDimensions(source)
  if (mime === 'image/webp') return webpDimensions(source)
  if (mime === 'image/gif') {
    if (source.length < 10) return null
    const width = source[6] | (source[7] << 8)
    const height = source[8] | (source[9] << 8)
    return width > 0 && height > 0 ? { width, height } : null
  }
  return null
}

function isJpegStandalone(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)
}

function isJpegFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

function jpegSize(source: Uint8Array, offset: number): { width: number; height: number } | null {
  const height = (source[offset + 5] << 8) | source[offset + 6]
  const width = (source[offset + 7] << 8) | source[offset + 8]
  return width > 0 && height > 0 ? { width, height } : null
}

function jpegDimensions(source: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  let orientation = 1
  let offset = 2
  while (offset + 9 <= source.length) {
    if (source[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = source[offset + 1]
    if (marker === 0xff) {
      offset++
      continue
    }
    if (isJpegStandalone(marker)) {
      offset += 2
      continue
    }
    if (marker === 0xda) return null
    const length = (source[offset + 2] << 8) | source[offset + 3]
    if (length < 2) return null
    const end = Math.min(source.length, offset + 2 + length)
    if (marker === JPEG_APP1) {
      orientation = exifOrientation(source, view, offset, end) ?? orientation
    }
    if (isJpegFrame(marker)) {
      const size = jpegSize(source, offset)
      if (!size) return null
      // Orientations 5 to 8 turn the photo a quarter, so its shown sides swap.
      return orientation >= 5 && orientation <= 8
        ? { width: size.height, height: size.width }
        : size
    }
    offset += 2 + length
  }
  return null
}

function pngDimensions(source: Uint8Array): { width: number; height: number } | null {
  if (source.length < 24) return null
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function readUint24LE(source: Uint8Array, offset: number): number {
  return source[offset] | (source[offset + 1] << 8) | (source[offset + 2] << 16)
}

function vp8Size(source: Uint8Array): { width: number; height: number } | null {
  if (source.length < 30) return null
  const width = (source[26] | (source[27] << 8)) & 0x3fff
  const height = (source[28] | (source[29] << 8)) & 0x3fff
  return width > 0 && height > 0 ? { width, height } : null
}

function vp8lSize(source: Uint8Array): { width: number; height: number } | null {
  if (source.length < 25) return null
  const bits = (source[21] | (source[22] << 8) | (source[23] << 16) | (source[24] << 24)) >>> 0
  return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) }
}

function webpDimensions(source: Uint8Array): { width: number; height: number } | null {
  if (source.length < 16) return null
  if (hasBytes(source, 12, 0x56, 0x50, 0x38, 0x58)) {
    if (source.length < 30) return null
    return {
      width: 1 + readUint24LE(source, 24),
      height: 1 + readUint24LE(source, 27)
    }
  }
  if (hasBytes(source, 12, 0x56, 0x50, 0x38, 0x20)) return vp8Size(source)
  if (hasBytes(source, 12, 0x56, 0x50, 0x38, 0x4c)) return vp8lSize(source)
  return null
}

interface ScaledImageDecoder {
  readonly tracks: { readonly ready: Promise<void> }
  decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>
  close(): void
}

interface ScaledImageDecoderConstructor {
  new (init: {
    data: Uint8Array
    type: string
    desiredWidth: number
    desiredHeight: number
  }): ScaledImageDecoder
  isTypeSupported(type: string): Promise<boolean>
}

/**
 * The browser's scaled decoder, read dynamically because the supported browser baseline does not
 * require WebCodecs; every caller falls back to a full bitmap where it is absent.
 */
function scaledImageDecoder(): ScaledImageDecoderConstructor | null {
  const candidate = Reflect.get(globalThis, 'ImageDecoder') as
    | ScaledImageDecoderConstructor
    | undefined
  return candidate && typeof candidate.isTypeSupported === 'function' ? candidate : null
}

async function decodeAtTarget(
  source: Uint8Array,
  mime: string,
  target: { width: number; height: number }
): Promise<ImageBitmap | null> {
  const Decoder = scaledImageDecoder()
  if (!Decoder) return null
  const supported = await Decoder.isTypeSupported(mime).catch(() => false)
  if (!supported) return null
  let decoder: ScaledImageDecoder | null = null
  try {
    decoder = new Decoder({
      data: source.slice(),
      type: mime,
      desiredWidth: target.width,
      desiredHeight: target.height
    })
    await decoder.tracks.ready
    const decoded = await decoder.decode({ frameIndex: 0 })
    try {
      return await createImageBitmap(decoded.image)
    } finally {
      decoded.image.close()
    }
  } catch {
    return null
  } finally {
    decoder?.close()
  }
}

async function createFallbackBitmap(
  source: Uint8Array<ArrayBuffer>,
  target: { width: number; height: number } | null
): Promise<ImageBitmap> {
  // Blob copies the bytes synchronously, so the graph's bytes are never detached.
  const blob = new Blob([source])
  if (!target) return createImageBitmap(blob)
  try {
    return await createImageBitmap(blob, {
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high'
    })
  } catch {
    return createImageBitmap(blob)
  }
}

/**
 * Serialize native browser decodes outside the CanvasKit heap without detaching graph bytes.
 * The browser decodes photos at the preview's size where it can, so a 128 px preview of a 4096 px
 * photo no longer decodes all 11 megapixels first.
 */
export function createImagePreviewDecoder(): ImagePreviewDecoder {
  let disposed = false
  function assertActive() {
    if (disposed) throw new Error('Image preview stopped')
  }

  return {
    async decode(source, edge) {
      assertActive()
      const data: Uint8Array<ArrayBuffer> =
        source.buffer instanceof ArrayBuffer
          ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
          : source.slice()
      const dimensions = imageDimensions(data)
      const target = dimensions ? previewSize(dimensions.width, dimensions.height, edge) : null
      const mime = imageMimeType(data)
      const bitmap =
        (target && mime ? await decodeAtTarget(data, mime, target) : null) ??
        (await createFallbackBitmap(data, target))
      const originalWidth = dimensions?.width ?? bitmap.width
      const originalHeight = dimensions?.height ?? bitmap.height

      try {
        assertActive()
        const size = target ?? previewSize(originalWidth, originalHeight, edge)
        const canvas = new OffscreenCanvas(size.width, size.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image preview canvas unavailable')
        context.drawImage(bitmap, 0, 0, size.width, size.height)
        const bytes = new Uint8Array(
          await (await canvas.convertToBlob(PREVIEW_ENCODING)).arrayBuffer()
        )
        assertActive()
        return { bytes, originalWidth, originalHeight }
      } finally {
        bitmap.close()
      }
    },
    destroy() {
      disposed = true
    }
  }
}

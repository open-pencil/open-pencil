import { sha1 } from '@noble/hashes/legacy.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { imageSize as readImageHeader } from 'image-size'
import { fromUint8Array, isValid, toUint8Array } from 'js-base64'

import MatrixMath, { type Mat3 } from './matrix'
import type { Matrix, Size } from './primitives'
import type { Fill, SceneNode } from './types'

/** Hashes already computed, by the bytes hashed: a save would otherwise hash every image again. */
const imageHashes = new WeakMap<Uint8Array, string>()

/**
 * The name an image's bytes are stored under: the hex SHA-1 of the bytes, as Figma names images,
 * so `.fig` files and the Figma clipboard can carry the name as it is. Documents saved before may
 * hold images under other names; anything that hands images to Figma still checks. Each array is
 * hashed once, as image bytes are never written into once read or stored.
 */
export function computeImageHash(data: Uint8Array): string {
  const known = imageHashes.get(data)
  if (known) return known
  const hash = bytesToHex(sha1(data))
  imageHashes.set(data, hash)
  return hash
}

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/avif'

/** The image types documents store, by the name `image-size` gives each format. */
const IMAGE_MIME_TYPES: Partial<Record<string, ImageMimeType>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif'
}

/** The raster types a dropped or pasted file can be imported as an image fill from. */
export const IMPORTABLE_RASTER_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif'
])

/** Whether a file is an SVG image, which some systems report without a media type. */
export function isSVGFile(file: { name: string; type: string }): boolean {
  return (
    file.type === 'image/svg+xml' || (file.type === '' && file.name.toLowerCase().endsWith('.svg'))
  )
}

export interface ImageHeader extends Size {
  type: ImageMimeType
}

/**
 * The type and size of a PNG, JPEG, GIF, WebP, or AVIF, read from its header by `image-size`; null for
 * bytes it cannot read and for other formats.
 */
export function imageHeader(data: Uint8Array): ImageHeader | null {
  let header: ReturnType<typeof readImageHeader>
  try {
    header = readImageHeader(data)
  } catch {
    return null
  }
  const type = header.type === undefined ? undefined : IMAGE_MIME_TYPES[header.type]
  return type ? { type, width: header.width, height: header.height } : null
}

/**
 * The media type of encoded image bytes, read from their header, for writing them out as a data
 * URL or file. Bytes it cannot read are reported as PNG, as image fills began.
 */
export function imageMimeType(data: Uint8Array): ImageMimeType {
  return imageHeader(data)?.type ?? 'image/png'
}

export interface DataURL {
  /** The media type in lowercase, without parameters; `text/plain` when the URL names none. */
  mimeType: string
  bytes: Uint8Array
}

/**
 * The media type and bytes a `data:` URL carries: a Base64 body decoded, and a percent-encoded
 * one unescaped as UTF-8 text, as SVG and other markup are written. Null for anything else: Base64
 * cut short in transit, and escapes that are not UTF-8, such as a binary image escaped byte by
 * byte, which a reader that must take any data URL, such as `.pen` loading, gets from `fetch`.
 */
export function parseDataURL(url: string): DataURL | null {
  const match = /^\s*data:([^,]*),(.*?)\s*$/is.exec(url)
  if (!match) return null
  const [, header = '', body = ''] = match
  const params = header.split(';').map((param) => param.trim())
  const base64 = params.length > 1 && params.at(-1)?.toLowerCase() === 'base64'
  const mimeType = params[0]?.toLowerCase() || 'text/plain'
  let text: string
  try {
    // A `%` that starts no escape is a literal percent sign, as in `width="100%"`.
    text = decodeURIComponent(body.replace(/%(?![\da-f]{2})/gi, '%25'))
  } catch {
    return null
  }
  if (!base64) return { mimeType, bytes: new TextEncoder().encode(text) }
  const compact = text.replace(/\s+/g, '')
  // Base64 one character past a whole group of four cannot be bytes: it was cut short.
  if (compact.replace(/={1,2}$/, '').length % 4 === 1 || !isValid(compact)) return null
  return { mimeType, bytes: toUint8Array(compact) }
}

/** Encoded image bytes as a Base64 data URL of the type their header names. */
export function imageDataURL(data: Uint8Array): string {
  return `data:${imageMimeType(data)};base64,${fromUint8Array(data)}`
}

/** SVG markup as a percent-encoded data URL, as CSS `url()` and `<img src>` take one. */
export function svgDataURL(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** An image's size in pixels, read from its header; null for bytes it cannot read. */
export function imageSize(data: Uint8Array): Size | null {
  const header = imageHeader(data)
  return header && { width: header.width, height: header.height }
}

/**
 * The crop that shows an image as Fill does: scaled to cover a `width` × `height` layer and
 * centred. Figma starts a crop from it, as the image-space window a crop's transform holds.
 */
export function coverImageTransform(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): Matrix {
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const m00 = width / scale / imageWidth
  const m11 = height / scale / imageHeight
  return { m00, m01: 0, m02: (1 - m00) / 2, m10: 0, m11, m12: (1 - m11) / 2 }
}

/**
 * Maps `img`'s pixels onto `node` as `fill` places them. `size` is the image's own size when `img`
 * is a downscaled preview, so a tile keeps its size. A crop places the image by its transform;
 * Fill, Fit and Tile ignore it, as Figma does, and turn the image by `imageRotation` first.
 */
export function imageFillMatrix(
  fill: Fill,
  node: Pick<SceneNode, 'width' | 'height'>,
  imgW: number,
  imgH: number,
  size: Size = { width: imgW, height: imgH }
): Mat3 {
  const scaleMode = fill.imageScaleMode ?? 'FILL'
  if (scaleMode === 'CROP' && fill.imageTransform) {
    const t = fill.imageTransform
    const inverse = MatrixMath.invert(MatrixMath.fromAffine(t))
    if (inverse)
      return MatrixMath.multiply(
        MatrixMath.scaled(node.width, node.height),
        inverse,
        MatrixMath.scaled(1 / imgW, 1 / imgH)
      )
  }

  const radians = ((fill.imageRotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const turnedW = size.width * cos + size.height * sin
  const turnedH = size.width * sin + size.height * cos
  const turned = MatrixMath.multiply(
    MatrixMath.translated(turnedW / 2, turnedH / 2),
    MatrixMath.rotated(radians),
    MatrixMath.translated(-size.width / 2, -size.height / 2),
    MatrixMath.scaled(size.width / imgW, size.height / imgH)
  )
  if (scaleMode === 'TILE') {
    const scale = fill.scale && fill.scale > 0 ? fill.scale : 1
    return MatrixMath.multiply(MatrixMath.scaled(scale, scale), turned)
  }
  const fit = scaleMode === 'FIT'
  const scale = (fit ? Math.min : Math.max)(node.width / turnedW, node.height / turnedH)
  return MatrixMath.multiply(
    MatrixMath.translated((node.width - turnedW * scale) / 2, (node.height - turnedH * scale) / 2),
    MatrixMath.scaled(scale, scale),
    turned
  )
}

/** The image a paint draws: an IMAGE paint's own, or the poster frame of a VIDEO paint. */
export function drawnImageHash(paint: Pick<Fill, 'type' | 'imageHash'>): string | undefined {
  return paint.type === 'IMAGE' || paint.type === 'VIDEO' ? paint.imageHash : undefined
}

/** The images `paints` show, by their hashes: a VIDEO paint shows its poster frame. */
export function imagePaintHashes(paints: Iterable<Fill>): string[] {
  return [...paints].flatMap((paint) => drawnImageHash(paint) ?? [])
}

/**
 * Copies the images `hashes` name from `from` into `to`, each as bytes of its own. An image is
 * named by its content, so one `to` already holds stays.
 */
export function copyImages(
  from: ReadonlyMap<string, Uint8Array>,
  to: Map<string, Uint8Array>,
  hashes: Iterable<string>
): void {
  for (const hash of hashes) {
    const bytes = from.get(hash)
    if (bytes && !to.has(hash)) to.set(hash, new Uint8Array(bytes))
  }
}

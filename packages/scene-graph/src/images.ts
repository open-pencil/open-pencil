import { sha1 } from '@noble/hashes/legacy.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { imageSize as readImageHeader } from 'image-size'

import type { Matrix, Size } from './primitives'

/**
 * The name an image's bytes are stored under: the hex SHA-1 of the bytes, as Figma names images,
 * so `.fig` files and the Figma clipboard can carry the name as it is. Documents saved before may
 * hold images under other names; anything that hands images to Figma still checks.
 */
export function computeImageHash(data: Uint8Array): string {
  return bytesToHex(sha1(data))
}

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

/** The image types documents store, by the name `image-size` gives each format. */
const IMAGE_MIME_TYPES: Partial<Record<string, ImageMimeType>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
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
 * The type and size of a PNG, JPEG, GIF, or WebP, read from its header by `image-size`; null for
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

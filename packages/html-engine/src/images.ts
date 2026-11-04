/**
 * The engine decodes no raster images, so layout learns an image's size from a stand-in SVG of
 * the same pixel size, read from the file's header. Formats are the ones browsers lay out from
 * their headers alone: PNG, GIF, WebP, JPEG, and AVIF.
 */

type Size = [width: number, height: number]

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

function webpSize(bytes: Uint8Array, view: DataView): Size | null {
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8 ')
    return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff]
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true)
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]
  }
  if (chunk === 'VP8X') {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
    return [width, height]
  }
  return null
}

/** Start-of-frame markers, which carry the size; C4, C8, and CC are other segments. */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

const APP1 = 0xe1
const ORIENTATION_TAG = 0x0112

/**
 * The Exif Orientation in an APP1 segment starting at `at`: 1 when the Exif data names none,
 * and null when the segment is not Exif, such as XMP, which says nothing about orientation. Orientations 5
 * to 8 turn the image a quarter, so browsers lay it out with width and height swapped.
 */
function exifOrientation(
  bytes: Uint8Array,
  view: DataView,
  at: number,
  end: number
): number | null {
  const tiff = at + 10
  if (tiff + 8 > end || ascii(bytes, at + 4, 6) !== 'Exif\0\0') return null
  const littleEndian = ascii(bytes, tiff, 2) === 'II'
  const firstIFD = tiff + view.getUint32(tiff + 4, littleEndian)
  if (firstIFD + 2 > end) return 1
  const entries = view.getUint16(firstIFD, littleEndian)
  for (let entry = 0; entry < entries; entry++) {
    const offset = firstIFD + 2 + entry * 12
    if (offset + 12 > end) return 1
    if (view.getUint16(offset, littleEndian) === ORIENTATION_TAG) {
      return view.getUint16(offset + 8, littleEndian)
    }
  }
  return 1
}

function jpegSize(bytes: Uint8Array, view: DataView): Size | null {
  let orientation = 1
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    // Any number of 0xFF fill bytes may come before a marker.
    let markerAt = at + 1
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt++
    if (markerAt + 7 >= bytes.length) return null
    const marker = bytes[markerAt]
    // A segment's length counts its own two bytes, so less is a broken file.
    const length = view.getUint16(markerAt + 1)
    if (length < 2) return null
    const segment = markerAt - 1
    const end = Math.min(bytes.length, markerAt + 1 + length)
    if (marker === APP1) orientation = exifOrientation(bytes, view, segment, end) ?? orientation
    if (isStartOfFrame(marker)) {
      const size: Size = [view.getUint16(markerAt + 6), view.getUint16(markerAt + 4)]
      return orientation >= 5 && orientation <= 8 ? [size[1], size[0]] : size
    }
    at = end
  }
  return null
}

const ISPE = [0x69, 0x73, 0x70, 0x65]

/**
 * An AVIF's size from its `ispe` box, wherever the file puts it: the box's type, then its
 * version and flags, then two 32-bit sizes. A match counts only when the size the box header
 * before it gives holds all of that and fits in the file.
 */
function avifSize(bytes: Uint8Array, view: DataView): Size | null {
  for (let at = 4; at + 16 <= bytes.length; at++) {
    if (ISPE.some((byte, index) => bytes[at + index] !== byte)) continue
    const boxSize = view.getUint32(at - 4)
    if (boxSize < 20 || at - 4 + boxSize > bytes.length) continue
    return [view.getUint32(at + 8), view.getUint32(at + 12)]
  }
  return null
}

/** An image file's pixel size from its header, or null for a format it does not know. */
export function rasterImageSize(bytes: Uint8Array): Size | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The size is in the IHDR chunk, which a PNG must start with.
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === 'PNG' &&
    ascii(bytes, 12, 4) === 'IHDR'
  ) {
    return [view.getUint32(16), view.getUint32(20)]
  }
  if (bytes.length > 10 && ascii(bytes, 0, 3) === 'GIF') {
    return [view.getUint16(6, true), view.getUint16(8, true)]
  }
  if (bytes.length > 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return webpSize(bytes, view)
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes, view)
  if (bytes.length > 32 && ascii(bytes, 4, 4) === 'ftyp' && /avi[fs]/.test(ascii(bytes, 8, 4))) {
    return avifSize(bytes, view)
  }
  return null
}

/** An empty SVG of the image's size, which the engine lays out as the image would be. */
export function imageStandIn([width, height]: Size): Uint8Array {
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`
  )
}

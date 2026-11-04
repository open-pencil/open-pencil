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

function jpegSize(bytes: Uint8Array, view: DataView): Size | null {
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]
    if (isStartOfFrame(marker)) return [view.getUint16(at + 7), view.getUint16(at + 5)]
    at += 2 + view.getUint16(at + 2)
  }
  return null
}

/** An image file's pixel size from its header, or null for a format it does not know. */
export function rasterImageSize(bytes: Uint8Array): Size | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length > 24 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
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
    const at = ascii(bytes, 0, Math.min(bytes.length, 4096)).indexOf('ispe')
    if (at > 0) return [view.getUint32(at + 8), view.getUint32(at + 12)]
  }
  return null
}

/** An empty SVG of the image's size, which the engine lays out as the image would be. */
export function imageStandIn(bytes: Uint8Array): Uint8Array | null {
  const size = rasterImageSize(bytes)
  if (!size) return null
  const [width, height] = size
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`
  )
}

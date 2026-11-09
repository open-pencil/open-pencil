import { expect, test } from 'bun:test'

import { imageDimensions, imageMimeType, previewSize } from '#vue/canvas/surface/image-preview'

function jpeg(width: number, height: number) {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00, // APP0, length 4, no payload
    0xff,
    0xc0, // SOF0
    0x00,
    0x11, // length 17
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01
  ])
}

/** A JPEG whose APP1 Exif segment names `orientation`, with a frame of `width` × `height`. */
function exifJpeg(width: number, height: number, orientation: number) {
  const exif = new Uint8Array([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF little-endian, IFD0 at 8
    0x01, 0x00, // one entry
    0x12, 0x01, // Orientation, 0x0112
    0x03, 0x00, // SHORT
    0x01, 0x00, 0x00, 0x00, // count 1
    orientation, 0x00, 0x00, 0x00, // value and padding
    0x00, 0x00, 0x00, 0x00 // no next IFD
  ])
  const frame = jpeg(width, height)
  const length = exif.length + 2
  const bytes = new Uint8Array(frame.length + 4 + exif.length)
  bytes.set(frame.subarray(0, 2), 0)
  bytes.set([0xff, 0xe1, length >> 8, length & 0xff], 2)
  bytes.set(exif, 6)
  bytes.set(frame.subarray(2), 6 + exif.length)
  return bytes
}

function png(width: number, height: number) {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

function webp(width: number, height: number) {
  const bytes = new Uint8Array(30)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x58], 12) // VP8X
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  bytes[24] = widthMinusOne & 0xff
  bytes[25] = (widthMinusOne >> 8) & 0xff
  bytes[26] = (widthMinusOne >> 16) & 0xff
  bytes[27] = heightMinusOne & 0xff
  bytes[28] = (heightMinusOne >> 8) & 0xff
  bytes[29] = (heightMinusOne >> 16) & 0xff
  return bytes
}

test('sizes a preview to the requested edge, never above the source', () => {
  expect(previewSize(4096, 2731, 128)).toEqual({ width: 128, height: 85 })
  expect(previewSize(4096, 2731, 512)).toEqual({ width: 512, height: 341 })
  expect(previewSize(121, 90, 128)).toEqual({ width: 121, height: 90 })
})

test('reads the source size from the encoded header', () => {
  expect(imageDimensions(jpeg(4096, 2731))).toEqual({ width: 4096, height: 2731 })
  expect(imageDimensions(png(1600, 900))).toEqual({ width: 1600, height: 900 })
  expect(imageDimensions(webp(4096, 2731))).toEqual({ width: 4096, height: 2731 })
  expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull()
})

test('turns JPEG dimensions the way Exif says the photo is shown', () => {
  // Orientations 5 to 8 turn the photo a quarter, so its shown width and height swap.
  expect(imageDimensions(exifJpeg(4096, 2731, 6))).toEqual({ width: 2731, height: 4096 })
  expect(imageDimensions(exifJpeg(4096, 2731, 8))).toEqual({ width: 2731, height: 4096 })
  expect(imageDimensions(exifJpeg(4096, 2731, 3))).toEqual({ width: 4096, height: 2731 })
  expect(imageDimensions(exifJpeg(4096, 2731, 1))).toEqual({ width: 4096, height: 2731 })
  expect(imageDimensions(exifJpeg(40, 20, 9))).toEqual({ width: 40, height: 20 })
})

test('names the image type for the browser decoder', () => {
  expect(imageMimeType(jpeg(10, 10))).toBe('image/jpeg')
  expect(imageMimeType(png(10, 10))).toBe('image/png')
  expect(imageMimeType(webp(10, 10))).toBe('image/webp')
  expect(imageMimeType(new Uint8Array([1, 2, 3]))).toBeNull()
})

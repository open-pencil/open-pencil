import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { createCanvasKitRasterCodec, reencodeImage } from '@open-pencil/core/io/formats/raster'

setDefaultTimeout(60_000)

/** A half-transparent gradient, so lossy encoders have colour and alpha to keep. */
function gradientPNG(codec: ReturnType<typeof createCanvasKitRasterCodec>) {
  const width = 64
  const height = 32
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set([x * 4, y * 8, 128, x < width / 2 ? 255 : 128], (y * width + x) * 4)
    }
  }
  return expectDefined(codec.encodePNG({ width, height, data }), 'PNG')
}

test('the shared CanvasKit encodes a PNG again as WebP, keeping its size and transparency', async () => {
  const ck = await getCanvasKit()
  const codec = createCanvasKitRasterCodec(ck)
  const webp = expectDefined(reencodeImage(ck, gradientPNG(codec), 'WEBP', 90), 'WebP')

  expect(new TextDecoder().decode(webp.subarray(8, 12))).toBe('WEBP')
  const image = expectDefined(codec.decode(webp), 'decoded WebP')
  expect([image.width, image.height]).toEqual([64, 32])
  const right = (16 * 64 + 48) * 4 + 3
  expect(image.data[right]).toBeGreaterThan(120)
  expect(image.data[right]).toBeLessThan(136)
})

test('the shared CanvasKit encodes JPEG', async () => {
  const ck = await getCanvasKit()
  const jpeg = expectDefined(
    reencodeImage(ck, gradientPNG(createCanvasKitRasterCodec(ck)), 'JPG', 90),
    'JPEG'
  )

  expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
})

test('an image CanvasKit cannot decode is not encoded', async () => {
  expect(reencodeImage(await getCanvasKit(), new Uint8Array([1, 2, 3]), 'WEBP', 90)).toBeNull()
})

import { expect, setDefaultTimeout, test } from 'bun:test'

import { fromUint8Array, toUint8Array } from 'js-base64'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { createCanvasKitRasterCodec } from '@open-pencil/core/io/formats/raster'

import { encodeWebPModelImage } from '@/app/ai/tools/model-image'

setDefaultTimeout(60_000)

async function png(pixel: (x: number, y: number) => number[]) {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data.set(pixel(x, y), (y * size + x) * 4)
  }
  const bytes = createCanvasKitRasterCodec(await getCanvasKit()).encodePNG({
    width: size,
    height: size,
    data
  })
  if (!bytes) throw new Error('PNG was not encoded')
  return { data: fromUint8Array(bytes), mediaType: 'image/png' }
}

/** Continuous tone, like a photo in a render, which PNG stores poorly. */
const wave = (x: number, y: number) =>
  [
    128 + 127 * Math.sin(x / 5) * Math.cos(y / 7),
    128 + 127 * Math.sin((x + y) / 9),
    128 + 127 * Math.cos((x * y) / 400),
    255
  ].map(Math.round)

test('sends a PNG render as a smaller WebP', async () => {
  const image = await png(wave)
  const encoded = await encodeWebPModelImage(image)

  expect(encoded.mediaType).toBe('image/webp')
  expect(toUint8Array(encoded.data).length).toBeLessThan(toUint8Array(image.data).length)
})

test('keeps a PNG that is smaller than its WebP', async () => {
  const image = await png((x, y) => ((x + y) % 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]))

  expect(await encodeWebPModelImage(image)).toEqual(image)
})

test('keeps an image that is not a PNG', async () => {
  const image = { data: 'AAAA', mediaType: 'image/jpeg' }

  expect(await encodeWebPModelImage(image)).toEqual(image)
})

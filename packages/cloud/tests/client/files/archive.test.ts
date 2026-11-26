import { describe, expect, test } from 'bun:test'

import { assembleCloudDocument, splitCloudDocument } from '#cloud/client'
import { strToU8, unzipSync, zipSync } from 'fflate'

describe('documents split for Cloud', () => {
  const image = new Uint8Array(4096).map((_, index) => index % 251)
  const meta = strToU8('{"file_name":"Doc"}')
  const file = zipSync({
    'canvas.fig': [strToU8('fig-kiwi'), { level: 0 }],
    'meta.json': meta,
    'images/abc123': [image, { level: 0 }]
  })

  test('take the images as views of the file and keep the rest in a lean archive', async () => {
    const { lean, images } = await splitCloudDocument(file)

    expect(images.map(({ name }) => name)).toEqual(['abc123'])
    expect(images[0]?.bytes).toEqual(image)
    expect(images[0]?.bytes.buffer).toBe(file.buffer)
    expect(unzipSync(lean)).toEqual({ 'canvas.fig': strToU8('fig-kiwi'), 'meta.json': meta })
  })

  test('open whole again with their images back in place', async () => {
    const { lean, images } = await splitCloudDocument(file)
    expect(unzipSync(await assembleCloudDocument(lean, images))).toEqual(unzipSync(file))
  })
})

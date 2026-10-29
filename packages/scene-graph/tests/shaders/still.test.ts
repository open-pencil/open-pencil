import { describe, expect, test } from 'bun:test'

import { shaderFrameEncoding, shaderFramePixels } from '@open-pencil/scene-graph/shaders'

/** RGBA pixels with every alpha set to `alpha`. */
function pixels(count: number, alpha: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4).fill(128)
  for (let index = 3; index < data.length; index += 4) data[index] = alpha
  return data
}

describe('shader still frames', () => {
  test('are drawn at twice the layer size, up to a 2048 pixel edge', () => {
    expect(shaderFramePixels({ width: 320, height: 160 })).toEqual({ width: 640, height: 320 })
    expect(shaderFramePixels({ width: 2000, height: 1000 })).toEqual({ width: 2048, height: 1024 })
  })

  test('are stored as JPEG when every pixel is opaque', () => {
    expect(shaderFrameEncoding(pixels(16, 255))).toEqual({ type: 'image/jpeg', quality: 0.9 })
  })

  test('are stored as PNG when any pixel lets the layer behind show through', () => {
    const data = pixels(16, 255)
    data[4 * 9 + 3] = 254
    expect(shaderFrameEncoding(data)).toEqual({ type: 'image/png' })
  })
})

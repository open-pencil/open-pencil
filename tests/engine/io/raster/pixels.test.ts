import { describe, expect, test } from 'bun:test'

import { copyAndUnpremultiplyPixels } from '#core/io/formats/raster/pixels'

describe('raw raster pixels', () => {
  test('copies pixels whose alpha needs no conversion', () => {
    const source = new Uint8Array([12, 34, 56, 255, 0, 0, 0, 0])

    const copied = copyAndUnpremultiplyPixels(source)

    expect(copied).toEqual(source)
    expect(copied).not.toBe(source)
  })

  test('unpremultiplies translucent pixels', () => {
    const source = new Uint8Array([6, 17, 28, 128, 22, 33, 44, 0])

    expect(copyAndUnpremultiplyPixels(source)).toEqual(
      new Uint8Array([12, 34, 56, 128, 0, 0, 0, 0])
    )
  })
})

import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'

import { initCanvasKit } from '#cli/headless'

const MATRIX_PATH = '/tmp/inkly-boolean-matrix.png'
const CELL_W = 180
const CELL_H = 150
const MATRIX_COLUMNS = 4
const MATRIX_ROWS = 8
const MIN_CELL_COLORED_PIXELS = 50

function isColoredPixel(pixels: Uint8Array, index: number): boolean {
  const isWhite = pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245
  return !isWhite && pixels[index + 3] > 0
}

function countCellColoredPixels(
  pixels: Uint8Array,
  imageWidth: number,
  column: number,
  row: number
): number {
  let count = 0
  const startX = column * CELL_W
  const startY = row * CELL_H
  for (let y = startY; y < startY + CELL_H; y++) {
    for (let x = startX; x < startX + CELL_W; x++) {
      if (isColoredPixel(pixels, (y * imageWidth + x) * 4)) count++
    }
  }
  return count
}

describe('boolean visual matrix', () => {
  test('generates a non-empty visual fixture for supported shape cases', async () => {
    const proc = Bun.spawnSync({
      cmd: ['bun', 'tests/engine/render/canvas/visual/boolean-matrix.ts'],
      stdout: 'pipe',
      stderr: 'pipe'
    })
    expect(proc.exitCode).toBe(0)
    expect(existsSync(MATRIX_PATH)).toBe(true)

    const ck = await initCanvasKit()
    const bytes = await Bun.file(MATRIX_PATH).arrayBuffer()
    const image = ck.MakeImageFromEncoded(bytes)
    expect(image).not.toBeNull()
    if (!image) return

    const imageWidth = image.width()
    const imageHeight = image.height()
    expect(imageWidth).toBe(720)
    expect(imageHeight).toBe(1200)

    const pixels = image.readPixels(0, 0, {
      width: imageWidth,
      height: imageHeight,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()

    let coloredPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (isColoredPixel(pixels, i)) coloredPixels++
    }
    expect(coloredPixels).toBeGreaterThan(20_000)

    for (let row = 0; row < MATRIX_ROWS; row++) {
      for (let column = 0; column < MATRIX_COLUMNS; column++) {
        expect(countCellColoredPixels(pixels, imageWidth, column, row)).toBeGreaterThan(
          MIN_CELL_COLORED_PIXELS
        )
      }
    }
  })
})

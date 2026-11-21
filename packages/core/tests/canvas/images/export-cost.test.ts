import { describe, expect, test } from 'bun:test'

import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneNode, Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { coveredRasterPixels, shaderIsCheaper } from '#core/canvas/images/export-cost'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()

function withCanvas<T>(width: number, height: number, use: (canvas: Canvas) => T): T {
  const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
  try {
    return use(surface.getCanvas())
  } finally {
    surface.dispose()
  }
}

function rect(width: number, height: number): SceneNode {
  return { width, height, independentStrokeWeights: false } as SceneNode
}

describe('the cost of baking', () => {
  const source = { width: 100, height: 100, bakesExactly: true, distinctColors: null }

  test('loses for an image it cannot read exactly in eight bits', () => {
    expect(shaderIsCheaper({ ...source, bakesExactly: false }, Number.POSITIVE_INFINITY)).toBe(true)
  })

  test('wins without counting when the draw covers as many pixels as the image holds', () => {
    expect(shaderIsCheaper(source, 10_000)).toBe(false)
  })

  test('loses without counting when even reading the image costs more than the draw', () => {
    expect(shaderIsCheaper(source, 100)).toBe(true)
    expect(shaderIsCheaper(source, 0)).toBe(true)
  })

  test('needs the colours counted in between', () => {
    expect(shaderIsCheaper(source, 1000)).toBe(false)
    expect(shaderIsCheaper({ ...source, distinctColors: 5000 }, 1000)).toBe(true)
    expect(shaderIsCheaper({ ...source, distinctColors: 50 }, 1000)).toBe(false)
  })
})

describe('the pixels a draw covers', () => {
  test('counts a rotated layer by its own area, not its bounding box', () => {
    withCanvas(4000, 4000, (canvas) => {
      canvas.translate(2000, 100)
      canvas.rotate(45, 0, 0)
      const target = { canvas, rasterPixelsPerDeviceUnit: 1 }
      expect(coveredRasterPixels(target, rect(2000, 8))).toBeCloseTo(16_000, 0)
    })
  })

  test.each([
    ['INSIDE', 1000 * 1000 - 998 * 998],
    ['CENTER', 1001 * 1001 - 999 * 999],
    ['OUTSIDE', 1002 * 1002 - 1000 * 1000]
  ] as const)('counts a stroke aligned %s by the band it paints', (align, band) => {
    withCanvas(1024, 1024, (canvas) => {
      const target = { canvas, rasterPixelsPerDeviceUnit: 1 }
      const stroke = { weight: 1, align } as Stroke
      expect(coveredRasterPixels(target, rect(1000, 1000), stroke)).toBe(band)
    })
  })

  test('counts nothing outside the clip', () => {
    withCanvas(64, 64, (canvas) => {
      canvas.translate(500, 500)
      expect(coveredRasterPixels({ canvas, rasterPixelsPerDeviceUnit: 1 }, rect(100, 100))).toBe(0)
    })
  })

  test('counts raster pixels per device unit', () => {
    withCanvas(64, 64, (canvas) => {
      expect(coveredRasterPixels({ canvas, rasterPixelsPerDeviceUnit: 2 }, rect(10, 10))).toBe(400)
    })
  })
})

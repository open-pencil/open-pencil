import { describe, expect, test } from 'bun:test'

import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import { makeImageFillLocalMatrix, patternTileLayout } from '#core/canvas/fills'

const node = {
  width: 120,
  height: 80
} as SceneNode

describe('canvas pattern fills', () => {
  test('uses scale, spacing, and alignment for rectangular pattern tiles', () => {
    const layout = patternTileLayout(
      { width: 20, height: 10 } as SceneNode,
      {
        type: 'PATTERN',
        scale: 2,
        patternSpacing: { x: 0.25, y: 0.5 },
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'END',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true
      } as Fill
    )

    expect(layout).toEqual({
      rect: { x: 0, y: 0, width: 50, height: 30 },
      scale: 2,
      positions: [{ x: -5, y: -10 }]
    })
  })

  test('adds an offset source copy for hexagonal pattern tiles', () => {
    const layout = patternTileLayout(
      { width: 20, height: 10 } as SceneNode,
      {
        type: 'PATTERN',
        patternTileType: 'HORIZONTAL_HEXAGONAL',
        patternSpacing: { x: 0, y: 0 },
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true
      } as Fill
    )

    expect(layout.positions).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 5 }
    ])
  })
})

/** Where image pixels land on the 120 × 80 layer. */
function place(fill: Partial<Fill>, imageWidth: number, imageHeight: number, points: number[]) {
  const image: Fill = {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    ...fill
  }
  const matrix = makeImageFillLocalMatrix(image, node, imageWidth, imageHeight)
  // Adding zero turns -0 into 0, which reads the same on the layer.
  return Matrix.mapPoints(matrix, points).map((value) => Math.round(value * 1000) / 1000 + 0)
}

describe('canvas image fills', () => {
  test.each([
    { width: 100, height: 100, scale: 0.8, x: 20, y: 0 },
    { width: 240, height: 80, scale: 0.5, x: 0, y: 20 },
    { width: 60, height: 40, scale: 2, x: 0, y: 0 }
  ])(
    'centers FIT images without stretching ($width × $height)',
    ({ width, height, scale, x, y }) => {
      expect(place({ imageScaleMode: 'FIT' }, width, height, [0, 0, width, height])).toEqual([
        x,
        y,
        x + width * scale,
        y + height * scale
      ])
    }
  )

  test('draws a tile at the image’s own size from the top left, times its scale', () => {
    expect(place({ imageScaleMode: 'TILE' }, 24, 16, [0, 0, 24, 16])).toEqual([0, 0, 24, 16])
    expect(place({ imageScaleMode: 'TILE', scale: 0.5 }, 24, 16, [24, 16])).toEqual([12, 8])
  })

  test('ignores the crop a tile keeps from before, as Figma does', () => {
    const imageTransform = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }
    expect(place({ imageScaleMode: 'TILE', imageTransform }, 24, 16, [24, 16])).toEqual([24, 16])
  })

  test('shows the window of the image a crop holds across the whole layer', () => {
    const imageTransform = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }
    expect(place({ imageScaleMode: 'CROP', imageTransform }, 40, 40, [10, 10, 30, 30])).toEqual([
      0, 0, 120, 80
    ])
  })

  test('turns a Fill image clockwise before covering the layer', () => {
    // A 40 × 60 image turned a quarter is 60 × 40, the layer's shape at half its size.
    expect(place({ imageScaleMode: 'FILL', imageRotation: 90 }, 40, 60, [0, 0, 40, 0])).toEqual([
      120, 0, 120, 80
    ])
  })
})

import { describe, expect, mock, test } from 'bun:test'

import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import { makeImageFillLocalMatrix, patternTileLayout } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'

function createRenderer() {
  return {
    ck: {
      Matrix: {
        identity: mock(() => ['identity']),
        invert: mock((matrix) => ['invert', matrix]),
        multiply: mock((...matrices) => ['multiply', ...matrices]),
        scaled: mock((x, y) => ['scaled', x, y]),
        translated: mock((x, y) => ['translated', x, y])
      }
    }
  } as SkiaRenderer
}

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

describe('canvas image fills', () => {
  test('keeps untransformed tile fills in image pixel space', () => {
    const renderer = createRenderer()
    const fill = { type: 'IMAGE', imageScaleMode: 'TILE' } as Fill

    const matrix = makeImageFillLocalMatrix(renderer, fill, node, 24, 16)

    expect(matrix).toEqual(['identity'])
    expect(renderer.ck.Matrix.identity).toHaveBeenCalled()
    expect(renderer.ck.Matrix.scaled).not.toHaveBeenCalled()
  })

  test('uses the full imported affine transform for patterned image fills', () => {
    const renderer = createRenderer()
    const transform = { m00: 0.5, m01: 0.1, m02: 0.25, m10: -0.2, m11: 0.25, m12: 0.5 }
    const fill = {
      type: 'IMAGE',
      imageScaleMode: 'TILE',
      imageTransform: transform
    } as Fill

    const matrix = makeImageFillLocalMatrix(renderer, fill, node, 40, 40)

    expect(renderer.ck.Matrix.invert).toHaveBeenCalledWith([
      0.5, 0.1, 0.25, -0.2, 0.25, 0.5, 0, 0, 1
    ])
    expect(matrix).toEqual([
      'multiply',
      ['scaled', 120, 80],
      ['invert', [0.5, 0.1, 0.25, -0.2, 0.25, 0.5, 0, 0, 1]],
      ['scaled', 0.025, 0.025]
    ])
  })
})

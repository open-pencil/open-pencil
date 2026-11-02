import { describe, expect, test } from 'bun:test'

import { canvasLabelForeground } from '@lawha/core/canvas'

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }

describe('canvas label contrast', () => {
  test('chooses the higher-contrast foreground for opaque midtones', () => {
    expect(canvasLabelForeground({ r: 0.49, g: 0.49, b: 0.49, a: 1 })).toEqual(BLACK)
  })

  test('composites translucent fills over the canvas before choosing contrast', () => {
    const translucentBlack = { r: 0, g: 0, b: 0, a: 0.2 }

    expect(canvasLabelForeground(translucentBlack, WHITE)).toEqual(BLACK)
    expect(canvasLabelForeground(translucentBlack, BLACK)).toEqual(WHITE)
  })
})

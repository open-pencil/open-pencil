import { describe, expect, test } from 'bun:test'

import { convertFills, fillToKiwiPaint } from '#fig/node-change/paint'

import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type { Fill, ImageScaleMode } from '@open-pencil/scene-graph'

const TRANSFORM = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.25, m12: 0.5 }

function imageFill(imageScaleMode: ImageScaleMode): Fill {
  return {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: '0123456789abcdef0123456789abcdef01234567',
    imageScaleMode,
    imageTransform: TRANSFORM
  }
}

describe('image scale mode in a .fig paint', () => {
  test('a cropped image is STRETCH in the file and keeps its transform', () => {
    const paint = fillToKiwiPaint(imageFill('CROP'))
    expect(paint.imageScaleMode).toBe('STRETCH')
    expect(paint.transform).toEqual(TRANSFORM)
  })

  test('a STRETCH paint reads as a crop', () => {
    const paint: Paint = { ...fillToKiwiPaint(imageFill('CROP')), imageScaleMode: 'STRETCH' }
    const [fill] = convertFills([paint])
    expect(fill?.imageScaleMode).toBe('CROP')
    expect(fill?.imageTransform).toEqual(TRANSFORM)
  })

  test.each(['FILL', 'FIT', 'TILE'] as const)('%s is written as it is', (mode) => {
    expect(fillToKiwiPaint(imageFill(mode)).imageScaleMode).toBe(mode)
  })
})

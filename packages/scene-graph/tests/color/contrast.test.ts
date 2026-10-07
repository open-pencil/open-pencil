import { describe, expect, test } from 'bun:test'

import { compositeOver, contrastRatio, readableForeground } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const GRAY_94: Color = { r: 0x94 / 255, g: 0x94 / 255, b: 0x94 / 255, a: 1 }

describe('contrastRatio', () => {
  test('matches the WCAG 2 extremes and is symmetric', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 6)
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 6)
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 6)
  })

  test('measures a mid gray on white', () => {
    expect(contrastRatio(GRAY_94, WHITE)).toBeCloseTo(3.03, 2)
  })
})

describe('compositeOver', () => {
  test('uses the foreground alpha by default and returns an opaque color', () => {
    expect(compositeOver({ ...BLACK, a: 0.5 }, WHITE)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 })
  })

  test('takes an explicit alpha for fill or node opacity', () => {
    const blended = compositeOver(BLACK, WHITE, 0.4)
    expect(blended.r).toBeCloseTo(0.6, 10)
    expect(contrastRatio(blended, WHITE)).toBeCloseTo(2.849, 3)
    expect(compositeOver(BLACK, WHITE, 0)).toEqual(WHITE)
  })
})

describe('readableForeground', () => {
  test('picks whichever of black and white contrasts more', () => {
    expect(readableForeground({ r: 0xeb / 255, g: 0x57 / 255, b: 0x4a / 255 })).toEqual(BLACK)
    expect(readableForeground({ r: 0x25 / 255, g: 0x63 / 255, b: 0xeb / 255 })).toEqual(WHITE)
    expect(readableForeground(GRAY_94)).toEqual(BLACK)
  })
})

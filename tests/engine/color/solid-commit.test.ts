import { describe, expect, test } from 'bun:test'

import { applySolidFillColor, applySolidStrokeColor } from '@open-pencil/vue'

import type { Fill, Stroke } from '@open-pencil/core'

describe('solid color commit helpers', () => {
  test('syncs fill opacity with color alpha', () => {
    const fill: Fill = {
      type: 'SOLID',
      visible: true,
      opacity: 1,
      color: { r: 1, g: 0, b: 0, a: 1 }
    }

    const updated = applySolidFillColor(fill, { r: 0, g: 1, b: 0, a: 0.4 })
    expect(updated.color.a).toBeCloseTo(0.4, 5)
    expect(updated.opacity).toBeCloseTo(0.4, 5)
  })

  test('syncs stroke opacity with color alpha', () => {
    const stroke: Stroke = {
      color: { r: 0, g: 0, b: 1, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'CENTER'
    }

    const updated = applySolidStrokeColor({ r: 1, g: 1, b: 0, a: 0.2 })
    expect(updated.color?.a).toBeCloseTo(0.2, 5)
    expect(updated.opacity).toBeCloseTo(0.2, 5)
  })
})

import { describe, expect, test } from 'bun:test'

import type { Fill, Stroke } from '@open-pencil/scene-graph'
import { applyStrokePaint } from '@open-pencil/vue'

const GRADIENT: Fill = {
  type: 'GRADIENT_LINEAR',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  gradientStops: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

function solidStroke(): Stroke {
  return {
    type: 'SOLID',
    color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
    weight: 6,
    opacity: 1,
    visible: true,
    align: 'OUTSIDE',
    cap: 'ROUND',
    join: 'BEVEL',
    dashPattern: [4, 2]
  }
}

describe('applyStrokePaint', () => {
  test('keeps the stroke geometry when the paint changes', () => {
    const next = applyStrokePaint(solidStroke(), GRADIENT)

    expect(next.type).toBe('GRADIENT_LINEAR')
    expect(next.gradientStops).toHaveLength(2)
    expect(next).toMatchObject({
      weight: 6,
      align: 'OUTSIDE',
      cap: 'ROUND',
      join: 'BEVEL',
      dashPattern: [4, 2]
    })
  })

  test('drops the old paint rather than leaving its stops behind', () => {
    const gradientStroke = applyStrokePaint(solidStroke(), GRADIENT)
    const back = applyStrokePaint(gradientStroke, {
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1, a: 1 },
      opacity: 1,
      visible: true
    })

    expect(back.type).toBe('SOLID')
    expect(back.gradientStops).toBeUndefined()
    expect(back.gradientTransform).toBeUndefined()
    expect(back.weight).toBe(6)
  })

  test('does not share the dash pattern with the stroke it came from', () => {
    const original = solidStroke()
    const next = applyStrokePaint(original, GRADIENT)
    next.dashPattern?.push(99)

    expect(original.dashPattern).toEqual([4, 2])
  })

  test('leaves cap and join unset when the stroke had none', () => {
    const plain: Stroke = {
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'INSIDE'
    }
    const next = applyStrokePaint(plain, GRADIENT)

    expect('cap' in next).toBe(false)
    expect('join' in next).toBe(false)
  })
})

import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'
import {
  fillCategory,
  fillIsTransparent,
  fillSwatchBackground,
  useFill
} from '@open-pencil/vue/primitives/Fill'
import { useGradientStops } from '@open-pencil/vue/primitives/GradientEditor'

const solid: Fill = {
  type: 'SOLID',
  color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
  opacity: 1,
  visible: true
}

function gradient(): Fill {
  return {
    ...solid,
    type: 'GRADIENT_LINEAR',
    gradientStops: [
      { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
      { color: { r: 0, g: 0, b: 1, a: 0.5 }, position: 1 }
    ]
  }
}

describe('fill model', () => {
  test('classifies supported fill categories', () => {
    expect(fillCategory(solid)).toBe('SOLID')
    expect(fillCategory(gradient())).toBe('GRADIENT')
    expect(fillCategory({ ...solid, type: 'IMAGE' })).toBe('IMAGE')
  })

  test('reports transparency from fill opacity and gradient stops', () => {
    expect(fillIsTransparent(solid)).toBe(false)
    expect(fillIsTransparent({ ...solid, opacity: 0.5 })).toBe(true)
    expect(fillIsTransparent(gradient())).toBe(true)
  })

  test('builds solid and gradient swatch backgrounds', () => {
    expect(fillSwatchBackground(solid)).toStartWith('rgb')
    expect(fillSwatchBackground(gradient())).toStartWith('linear-gradient')
  })

  test('converts between categories without mutating the source', () => {
    const source = ref(structuredClone(solid))
    const updates: Fill[] = []
    const model = useFill(source, (fill) => updates.push(fill))

    model.toSolid()
    expect(updates).toHaveLength(0)

    model.toGradient()
    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('GRADIENT_LINEAR')
    expect(updates[0].gradientStops).toHaveLength(2)
    expect(source.value).toEqual(solid)

    source.value = updates[0]
    model.toImage()
    expect(updates[1].type).toBe('IMAGE')
  })
})

describe('gradient stop color model', () => {
  test('preserves alpha while applying hex through useColorModel', () => {
    const source = ref(gradient())
    let updated = source.value
    const model = useGradientStops(source, (fill) => {
      updated = fill
      source.value = fill
    })

    model.updateStopColor(1, '00ff00')

    expect(updated.gradientStops?.[1].color).toEqual({ r: 0, g: 1, b: 0, a: 0.5 })
  })

  test('clamps keyboard-compatible percent position updates', () => {
    const source = ref(gradient())
    let updated = source.value
    const model = useGradientStops(source, (fill) => {
      updated = fill
      source.value = fill
    })

    model.updateStopPosition(0, 125)
    expect(updated.gradientStops?.[0].position).toBe(1)
    model.updateStopPosition(0, -5)
    expect(updated.gradientStops?.[0].position).toBe(0)
  })
})

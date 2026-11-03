import { describe, expect, test } from 'bun:test'

import { effectBindingTarget, paintBindingTarget } from '@open-pencil/scene-graph/variables'

describe('paint binding fields', () => {
  test('name the fill or stroke whose colour they bind', () => {
    expect(paintBindingTarget('fills/1/color')).toEqual({ list: 'fills', index: 1 })
    expect(paintBindingTarget('strokes/0/color')).toEqual({ list: 'strokes', index: 0 })
  })

  test('are not any other binding field', () => {
    for (const field of [
      'fills',
      'opacity',
      'effects/0/color',
      'fills/first/color',
      'fills/0/opacity'
    ])
      expect(paintBindingTarget(field)).toBeNull()
  })
})

describe('effect binding fields', () => {
  test('name the effect and the property they bind', () => {
    expect(effectBindingTarget('effects/1/offsetY')).toEqual({ index: 1, property: 'offsetY' })
    expect(effectBindingTarget('effects/0/color')).toEqual({ index: 0, property: 'color' })
  })

  test('are not any other binding field', () => {
    for (const field of ['effects', 'effects/0/offset', 'effects/x/radius', 'fills/0/color'])
      expect(effectBindingTarget(field)).toBeNull()
  })
})

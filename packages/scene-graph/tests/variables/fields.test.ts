import { describe, expect, test } from 'bun:test'

import { paintBindingTarget } from '@open-pencil/scene-graph/variables'

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

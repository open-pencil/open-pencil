import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'

import { expectDefined, getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

function effectsOf(effect: PenNode['effect']) {
  return getNodeOrThrow(
    parseDocument([{ id: 'shape', type: 'rectangle', width: 100, height: 80, effect }]),
    'shape'
  ).effects
}

describe('parsePenFile — effects', () => {
  test('reads layer and background blurs', () => {
    expect(
      effectsOf([
        { type: 'blur', radius: 8 },
        { type: 'background_blur', radius: 4 }
      ]).map((effect) => [effect.type, effect.radius])
    ).toEqual([
      ['LAYER_BLUR', 8],
      ['BACKGROUND_BLUR', 4]
    ])
  })

  test('reads inner and outer shadows', () => {
    const [outer, inner] = effectsOf([
      { type: 'shadow', offset: { x: 6, y: 8 }, blur: 10, color: '#00000080' },
      { type: 'shadow', shadowType: 'inner', offset: { x: 4, y: 4 }, blur: 6, enabled: false }
    ])
    expect(outer).toMatchObject({
      type: 'DROP_SHADOW',
      offset: { x: 6, y: 8 },
      radius: 10,
      visible: true
    })
    expect(expectDefined(outer).color.a).toBeCloseTo(128 / 255)
    expect(inner).toMatchObject({ type: 'INNER_SHADOW', radius: 6, visible: false })
  })

  test('skips shader effects', () => {
    expect(effectsOf({ type: 'shader', url: './fx.glsl' })).toEqual([])
  })
})

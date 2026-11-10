import { describe, expect, test } from 'bun:test'

import type { Effect } from '@open-pencil/scene-graph'
import { DEFAULT_GLASS } from '@open-pencil/scene-graph/constants'

import { createDefaultEffect, effectOptionsFor } from '#vue/controls/effects/helpers'

const glass: Effect = { ...createDefaultEffect(), type: 'GLASS', glass: { ...DEFAULT_GLASS } }
const offersGlass = (effects: Effect[], index: number) =>
  effectOptionsFor(effects, index).some((option) => option.value === 'GLASS')

describe('effect type options', () => {
  test('glass is offered only where no other row holds it', () => {
    const effects = [glass, createDefaultEffect()]
    expect(offersGlass(effects, 0)).toBe(true)
    expect(offersGlass(effects, 1)).toBe(false)
    expect(offersGlass([createDefaultEffect()], 0)).toBe(true)
  })

  test('every glass row keeps glass when a script gave the layer several', () => {
    const effects = [glass, glass]
    expect(offersGlass(effects, 0)).toBe(true)
    expect(offersGlass(effects, 1)).toBe(true)
  })
})

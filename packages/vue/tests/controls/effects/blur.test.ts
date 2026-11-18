import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import {
  blurKindChange,
  createDefaultEffect,
  createEffectControlActions
} from '#vue/controls/effects/helpers'

const progressive = {
  startRadius: 2,
  startOffset: { x: 0.5, y: 0 },
  endOffset: { x: 0.5, y: 1 }
}
const blur: Effect = { ...createDefaultEffect(), type: 'LAYER_BLUR', radius: 12, progressive }

function typeChange(effect: Effect, type: Effect['type']): Partial<Effect> {
  const node: SceneNode = createDefaultNode(() => 'blurred', 'RECTANGLE', { effects: [effect] })
  let changes: Partial<Effect> = {}
  createEffectControlActions(ref<number | null>(null)).updateType(
    (_, patch) => {
      changes = patch
    },
    node,
    0,
    type
  )
  return changes
}

describe('blur kind', () => {
  test('a blur turned progressive runs from none at the top centre to the bottom centre', () => {
    expect(blurKindChange('PROGRESSIVE')).toEqual({
      progressive: { startRadius: 0, startOffset: { x: 0.5, y: 0 }, endOffset: { x: 0.5, y: 1 } }
    })
    expect(blurKindChange('UNIFORM')).toEqual({ progressive: undefined })
  })

  test('a progressive blur keeps its ramp as another blur and drops it as anything else', () => {
    expect(typeChange(blur, 'BACKGROUND_BLUR')).not.toHaveProperty('progressive')
    expect(typeChange(blur, 'DROP_SHADOW')).toMatchObject({ progressive: undefined })
    expect(typeChange(blur, 'GLASS')).toMatchObject({ progressive: undefined })
  })
})

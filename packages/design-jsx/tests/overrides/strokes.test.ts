import { describe, expect, test } from 'bun:test'

import { applyStrokeOverrides } from '#design-jsx/overrides/strokes'

import type { SceneNode } from '@open-pencil/scene-graph'

function strokeOverrides(props: Record<string, unknown>): Partial<SceneNode> {
  const overrides: Partial<SceneNode> = {}
  applyStrokeOverrides(props, overrides)
  return overrides
}

describe('stroke props', () => {
  test('dashPattern dashes a stroke without a dash of its own', () => {
    const overrides = strokeOverrides({ stroke: '#000', dashPattern: [6, 3] })
    expect(overrides.dashPattern).toEqual([6, 3])
    expect(overrides.strokes?.[0]?.dashPattern).toEqual([6, 3])
  })

  test('a stroke’s own dash wins over dashPattern', () => {
    const overrides = strokeOverrides({
      strokes: [{ color: '#000', dash: [2, 2] }, { color: '#f00' }],
      dashPattern: [6, 3]
    })
    expect(overrides.strokes?.map((stroke) => stroke.dashPattern)).toEqual([
      [2, 2],
      [6, 3]
    ])
  })
})

import { describe, expect, test } from 'bun:test'

import { applyStrokeOverrides } from '#design-jsx/overrides/strokes'

import type { SceneNode } from '@open-pencil/scene-graph'

function strokeOverrides(props: Record<string, unknown>): Partial<SceneNode> {
  const overrides: Partial<SceneNode> = {}
  applyStrokeOverrides(props, overrides, 'srgb')
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
  test('a stroke written with a paint type reads as an untyped one, unless it is a shader', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 }
    const untyped = strokeOverrides({ strokes: [{ color: red, weight: 4, align: 'center' }] })
    expect(
      strokeOverrides({ strokes: [{ type: 'SOLID', color: red, weight: 4, align: 'center' }] })
    ).toEqual(untyped)
    expect(
      strokeOverrides({ strokes: [{ type: 'GARBAGE', color: red, weight: 4, align: 'center' }] })
    ).toEqual(untyped)
    expect(untyped.strokes?.[0]).toMatchObject({ type: 'SOLID', align: 'CENTER', visible: true })
  })

  test('a shader stroke reads like any other stroke and keeps its shader', () => {
    const red = { r: 1, g: 0, b: 0, a: 0.5 }
    const asset = { key: 'abc', version: 'v1' }
    const plain = strokeOverrides({ strokes: [{ color: red, align: 'center' }] })
    for (const type of ['CUSTOM', 'custom']) {
      const shader = strokeOverrides({
        strokes: [{ type, color: red, align: 'center', customEffectAssetRef: asset }]
      })
      expect(shader.strokes).toEqual(
        plain.strokes?.map((stroke) => ({ ...stroke, type: 'CUSTOM', customEffectAssetRef: asset }))
      )
    }
  })
})

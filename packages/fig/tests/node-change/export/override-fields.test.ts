import { describe, expect, test } from 'bun:test'

import { OVERRIDE_ENCODERS } from '#fig/node-change/export/override-fields'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function node(type: SceneNode['type'], props: Partial<SceneNode> = {}): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode(type, graph.getPages()[0].id, props)
}

describe('override claim encoders', () => {
  test('auto layout alignment, with cross-axis stretch kept on the children', () => {
    const frame = node('FRAME', {
      layoutMode: 'HORIZONTAL',
      primaryAxisAlign: 'SPACE_BETWEEN',
      counterAxisAlign: 'STRETCH'
    })
    expect(OVERRIDE_ENCODERS.stackPrimaryAlignItems(frame)).toEqual({
      stackPrimaryAlignItems: 'SPACE_BETWEEN'
    })
    // Figma stretches each child rather than aligning the frame's items to stretch.
    expect(OVERRIDE_ENCODERS.stackCounterAlignItems(frame)).toEqual({
      stackCounterAlignItems: 'MIN'
    })
  })

  test('effects in the NodeChange encoding', () => {
    const shadow = node('RECTANGLE', {
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(OVERRIDE_ENCODERS.effects(shadow)).toEqual({
      effects: [
        expect.objectContaining({ type: 'FOREGROUND_BLUR', radius: 4, blendMode: 'NORMAL' })
      ]
    })
    expect(OVERRIDE_ENCODERS.effects(node('RECTANGLE'))).toEqual({ effects: [] })
  })

  test('per-side stroke weights, stating the flag even when off', () => {
    const sides = node('RECTANGLE', {
      independentStrokeWeights: true,
      borderTopWeight: 3,
      borderRightWeight: 0,
      borderBottomWeight: 1,
      borderLeftWeight: 2
    })
    expect(OVERRIDE_ENCODERS.borderStrokeWeightsIndependent(sides)).toEqual({
      borderStrokeWeightsIndependent: true,
      borderTopWeight: 3,
      borderRightWeight: 0,
      borderBottomWeight: 1,
      borderLeftWeight: 2
    })
    expect(OVERRIDE_ENCODERS.borderStrokeWeightsIndependent(node('RECTANGLE'))).toMatchObject({
      borderStrokeWeightsIndependent: false
    })
  })

  test('letter spacing in pixels and vertical text alignment', () => {
    const text = node('TEXT', { letterSpacing: 2, textAlignVertical: 'BOTTOM' })
    expect(OVERRIDE_ENCODERS.letterSpacing(text)).toEqual({
      letterSpacing: { value: 2, units: 'PIXELS' }
    })
    expect(OVERRIDE_ENCODERS.textAlignVertical(text)).toEqual({ textAlignVertical: 'BOTTOM' })
  })

  test('automatic line height as Figma writes it', () => {
    expect(OVERRIDE_ENCODERS.lineHeight(node('TEXT', { lineHeight: null }))).toEqual({
      lineHeight: { value: 100, units: 'PERCENT' }
    })
  })
})

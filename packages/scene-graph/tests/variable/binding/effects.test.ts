import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Effect } from '@open-pencil/scene-graph'
import {
  effectBindingTarget,
  reconcileVariableBindings,
  resolvedEffectBindings
} from '@open-pencil/scene-graph/variables'

const SHADOW: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 1, g: 0, b: 0, a: 1 },
  offset: { x: 1, y: 2 },
  radius: 3,
  spread: 4,
  visible: true,
  blendMode: 'NORMAL'
}

const BLUR: Effect = {
  type: 'LAYER_BLUR',
  color: { r: 0, g: 0, b: 0, a: 0 },
  offset: { x: 0, y: 0 },
  radius: 4,
  spread: 0,
  visible: true
}

/** A Light and Dark elevation, as a design system binds a card's shadow. */
function elevation() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Theme')
  const dark = graph.createMode(collection.id, 'Dark') ?? ''
  const color = graph.createVariable('Shadow', 'COLOR', collection.id, {
    r: 0,
    g: 0,
    b: 0.5,
    a: 0.25
  })
  const blur = graph.createVariable('Blur', 'FLOAT', collection.id, 8)
  const lift = graph.createVariable('Lift', 'FLOAT', collection.id, 4)
  color.valuesByMode[dark] = { r: 0, g: 0, b: 0, a: 0.6 }
  blur.valuesByMode[dark] = 24
  lift.valuesByMode[dark] = -7
  const card = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    effects: [SHADOW, BLUR]
  })
  return { graph, collection, dark, color, blur, lift, card }
}

describe('effect binding fields', () => {
  test('name the effect and the property they bind', () => {
    expect(effectBindingTarget('effects/1/offsetY')).toEqual({ index: 1, property: 'offsetY' })
    expect(effectBindingTarget('effects/0/color')).toEqual({ index: 0, property: 'color' })
  })

  test('are not paint or unknown effect fields', () => {
    for (const field of ['effects', 'effects/0/offset', 'effects/x/radius', 'fills/0/color'])
      expect(effectBindingTarget(field)).toBeNull()
  })
})

describe('effect bindings', () => {
  test('resolve each property in the layer mode, colour alpha included', () => {
    const { graph, collection, dark, color, blur, lift, card } = elevation()
    graph.bindVariable(card.id, 'effects/0/color', color.id)
    graph.bindVariable(card.id, 'effects/0/radius', blur.id)
    graph.bindVariable(card.id, 'effects/0/offsetY', lift.id)
    graph.bindVariable(card.id, 'effects/1/radius', blur.id)

    reconcileVariableBindings(graph)
    expect(graph.getNode(card.id)?.effects).toEqual([
      { ...SHADOW, color: { r: 0, g: 0, b: 0.5, a: 0.25 }, radius: 8, offset: { x: 1, y: 4 } },
      { ...BLUR, radius: 8 }
    ])

    graph.updateNode(card.id, { variableModes: { [collection.id]: dark } })
    reconcileVariableBindings(graph)
    expect(graph.getNode(card.id)?.effects).toEqual([
      { ...SHADOW, color: { r: 0, g: 0, b: 0, a: 0.6 }, radius: 24, offset: { x: 1, y: -7 } },
      { ...BLUR, radius: 24 }
    ])
  })

  test('keep a negative length as the variable gives it', () => {
    const { graph, collection, dark, lift, card } = elevation()
    graph.bindVariable(card.id, 'effects/0/spread', lift.id)
    graph.updateNode(card.id, { variableModes: { [collection.id]: dark } })

    expect(resolvedEffectBindings(graph, card).effects?.[0].spread).toBe(-7)
  })

  test('change nothing when the effects already hold the values', () => {
    const { graph, blur, card } = elevation()
    graph.bindVariable(card.id, 'effects/0/radius', blur.id)
    reconcileVariableBindings(graph)

    expect(resolvedEffectBindings(graph, graph.getNode(card.id) ?? card)).toEqual({})
  })

  test('keep the effect style the layer uses', () => {
    const { graph, blur, card } = elevation()
    graph.updateNode(card.id, { effectStyleId: 'style:elevation' })
    graph.bindVariable(card.id, 'effects/0/radius', blur.id)
    reconcileVariableBindings(graph)

    expect(graph.getNode(card.id)?.effectStyleId).toBe('style:elevation')
  })

  test('refuse a missing effect, a property a blur lacks, and the wrong variable type', () => {
    const { graph, color, blur, card } = elevation()

    expect(() => graph.bindVariable(card.id, 'effects/2/radius', blur.id)).toThrow(
      'Index 2 out of range for effects (length 2)'
    )
    expect(() => graph.bindVariable(card.id, 'effects/1/color', color.id)).toThrow(
      'A LAYER_BLUR effect has no bindable color ("effects/1/color")'
    )
    expect(() => graph.bindVariable(card.id, 'effects/0/radius', color.id)).toThrow(
      'Cannot bind COLOR variable to effect field "effects/0/radius"'
    )
    expect(() => graph.bindVariable(card.id, 'effects/0/color', blur.id)).toThrow(
      'Cannot bind FLOAT variable to effect field "effects/0/color"'
    )
  })
})

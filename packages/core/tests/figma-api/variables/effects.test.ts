import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
beforeAll(() => registerTestFont())

// Expected values and messages were recorded by running the same calls in Figma desktop.

const DROP = {
  type: 'DROP_SHADOW' as const,
  color: { r: 1, g: 0, b: 0, a: 1 },
  offset: { x: 1, y: 2 },
  radius: 3,
  spread: 4,
  visible: true,
  blendMode: 'NORMAL' as const
}

/** Light and Dark shadow tokens, as the probe in Figma set them up. */
function elevation() {
  const api = createAPI()
  const collection = api.variables.createVariableCollection('Elevation')
  const light = collection.defaultModeId
  const dark = collection.addMode('Dark')
  const color = api.variables.createVariable('shadowColor', collection, 'COLOR')
  color.setValueForMode(light, { r: 0, g: 0, b: 0.5, a: 0.25 })
  color.setValueForMode(dark, { r: 0, g: 0, b: 0, a: 0.6 })
  const radius = api.variables.createVariable('shadowRadius', collection, 'FLOAT')
  radius.setValueForMode(light, 8)
  radius.setValueForMode(dark, 24)
  const label = api.variables.createVariable('label', collection, 'STRING')
  return { api, collection, dark, color, radius, label }
}

const alias = (id: string) => ({ type: 'VARIABLE_ALIAS' as const, id })

describe('setBoundVariableForEffect', () => {
  test('returns a bound copy whose values are not resolved and whose spread reads 0', () => {
    const { api, color } = elevation()
    const bound = api.variables.setBoundVariableForEffect(DROP, 'color', color)

    expect(bound).toEqual({ ...DROP, spread: 0, boundVariables: { color: alias(color.id) } })
    expect(DROP).not.toHaveProperty('boundVariables')
    expect(api.variables.setBoundVariableForEffect(bound, 'color', null).boundVariables).toEqual({})
  })

  test('binding keeps the effect’s other bindings and null clears them all', () => {
    const { api, color, radius } = elevation()
    const both = api.variables.setBoundVariableForEffect(
      api.variables.setBoundVariableForEffect(DROP, 'color', color),
      'radius',
      radius
    )

    expect(both.boundVariables).toEqual({ color: alias(color.id), radius: alias(radius.id) })
    expect(api.variables.setBoundVariableForEffect(both, 'radius', null).boundVariables).toEqual({})
  })

  test('returns a copy that shares no aliases with the effect it was made from', () => {
    const { api, color, radius } = elevation()
    const bound = api.variables.setBoundVariableForEffect(DROP, 'color', color)
    const copy = api.variables.setBoundVariableForEffect(bound, 'radius', radius)
    const aliases = copy.boundVariables
    if (aliases && 'color' in aliases && aliases.color) aliases.color.id = radius.id

    expect(bound.boundVariables).toEqual({ color: alias(color.id) })
  })

  test('binds every shadow property and a blur’s radius only', () => {
    const { api, radius } = elevation()
    for (const field of ['radius', 'spread', 'offsetX', 'offsetY'] as const)
      expect(api.variables.setBoundVariableForEffect(DROP, field, radius).boundVariables).toEqual({
        [field]: alias(radius.id)
      })

    const blur = {
      type: 'LAYER_BLUR' as const,
      radius: 4,
      visible: true,
      blurType: 'NORMAL' as const
    }
    expect(api.variables.setBoundVariableForEffect(blur, 'radius', radius)).toEqual({
      ...blur,
      boundVariables: { radius: alias(radius.id) }
    })
    expect(() => api.variables.setBoundVariableForEffect(blur, 'color', radius)).toThrow(
      'in setBoundVariableForEffect: Property "field" failed validation: Invalid input: expected "radius"'
    )
  })

  test('refuses other fields, the wrong variable type, and a variable ID', () => {
    const { api, color, radius, label } = elevation()
    const bind = (field: string, variable: unknown) => () =>
      Reflect.apply(api.variables.setBoundVariableForEffect, api.variables, [DROP, field, variable])

    expect(bind('offset', radius)).toThrow(
      'in setBoundVariableForEffect: Property "field" failed validation: Invalid option: expected one of "color"|"radius"|"spread"|"offsetX"|"offsetY"'
    )
    expect(bind('color', radius)).toThrow(
      'in setBoundVariableForEffect: can only bind color variables to color'
    )
    expect(bind('radius', color)).toThrow(
      'in setBoundVariableForEffect: can only bind float variables to radius'
    )
    expect(bind('offsetX', label)).toThrow(
      'in setBoundVariableForEffect: can only bind float variables to offsetX'
    )
    expect(bind('radius', radius.id)).toThrow(
      'in setBoundVariableForEffect: Expected node, got string'
    )
  })
})

describe('bound effects on a layer', () => {
  test('read resolved in the layer’s mode and carry their variables', () => {
    const { api, collection, dark, color, radius } = elevation()
    let effect = api.variables.setBoundVariableForEffect(DROP, 'color', color)
    effect = api.variables.setBoundVariableForEffect(effect, 'radius', radius)
    effect = api.variables.setBoundVariableForEffect(effect, 'offsetY', radius)
    const rect = api.createRectangle()
    rect.effects = [effect]
    const bindings = { color: alias(color.id), radius: alias(radius.id), offsetY: alias(radius.id) }

    expect(rect.effects).toEqual([
      {
        ...DROP,
        color: { r: 0, g: 0, b: 0.5, a: 0.25 },
        radius: 8,
        offset: { x: 1, y: 8 },
        spread: 0,
        boundVariables: bindings,
        showShadowBehindNode: true
      }
    ])
    expect(rect.boundVariables).toEqual({ effects: [alias(color.id), alias(radius.id)] })

    rect.setExplicitVariableModeForCollection(collection, dark)
    expect(rect.effects[0]).toMatchObject({
      color: { r: 0, g: 0, b: 0, a: 0.6 },
      radius: 24,
      offset: { x: 1, y: 24 }
    })
  })

  test('list each variable once, by ID, hidden effects included', () => {
    const { api, color, radius } = elevation()
    const rect = api.createRectangle()
    rect.effects = [
      { ...api.variables.setBoundVariableForEffect(DROP, 'radius', radius), visible: false },
      api.variables.setBoundVariableForEffect(DROP, 'color', color),
      api.variables.setBoundVariableForEffect(DROP, 'spread', radius)
    ]

    expect(rect.boundVariables).toEqual({ effects: [alias(color.id), alias(radius.id)] })
  })

  test('unbind when set without the reference, keeping the value', () => {
    const { api, collection, dark, radius } = elevation()
    const rect = api.createRectangle()
    rect.setExplicitVariableModeForCollection(collection, dark)
    rect.effects = [api.variables.setBoundVariableForEffect(DROP, 'radius', radius)]
    rect.effects = [api.variables.setBoundVariableForEffect(rect.effects[0], 'radius', null)]

    expect(rect.effects[0]).toMatchObject({ radius: 24, boundVariables: {} })
    expect(rect.boundVariables).toEqual({})
  })

  test('follow an effect style’s variables in the layer’s own mode', async () => {
    const { api, collection, dark, radius } = elevation()
    const style = api.createEffectStyle()
    style.effects = [api.variables.setBoundVariableForEffect(DROP, 'radius', radius)]
    const rect = api.createRectangle()
    await rect.setEffectStyleIdAsync(style.id)
    rect.setExplicitVariableModeForCollection(collection, dark)

    expect(rect.effects[0]).toMatchObject({
      radius: 24,
      boundVariables: { radius: alias(radius.id) }
    })
    expect(rect.boundVariables).toEqual({ effects: [alias(radius.id)] })

    await rect.setEffectStyleIdAsync('')
    expect(rect.boundVariables).toEqual({ effects: [alias(radius.id)] })
  })

  test('follow a style rebound to another variable of the same value', async () => {
    const { api, collection, radius } = elevation()
    const twin = api.variables.createVariable('twin', collection, 'FLOAT')
    twin.setValueForMode(collection.defaultModeId, 8)
    const style = api.createEffectStyle()
    style.effects = [api.variables.setBoundVariableForEffect(DROP, 'radius', radius)]
    const rect = api.createRectangle()
    await rect.setEffectStyleIdAsync(style.id)

    style.effects = [api.variables.setBoundVariableForEffect(DROP, 'radius', twin)]
    expect(rect.effects[0]).toMatchObject({ radius: 8, boundVariables: { radius: alias(twin.id) } })
    expect(rect.effectStyleId).toBe(style.id)

    twin.setValueForMode(collection.defaultModeId, 20)
    radius.setValueForMode(collection.defaultModeId, 50)
    expect(rect.effects[0].radius).toBe(20)
    expect(rect.boundVariables).toEqual({ effects: [alias(twin.id)] })
  })

  test('resolve in an instance’s mode', () => {
    const { api, collection, dark, color } = elevation()
    const component = api.createComponent()
    component.effects = [api.variables.setBoundVariableForEffect(DROP, 'color', color)]
    const instance = component.createInstance()
    instance.setExplicitVariableModeForCollection(collection, dark)

    expect(instance.effects[0].type === 'DROP_SHADOW' && instance.effects[0].color).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0.6
    })
  })

  test('scale with an instance, whenever bound, and not with a plain layer', () => {
    const { api, collection, dark, radius } = elevation()
    const shadow = api.variables.setBoundVariableForEffect(DROP, 'radius', radius)
    const rect = api.createRectangle()
    rect.effects = [shadow]
    rect.rescale(2)
    rect.setExplicitVariableModeForCollection(collection, dark)
    expect(rect.effects[0].radius).toBe(24)

    const component = api.createComponent()
    const child = api.createRectangle()
    component.appendChild(child)
    child.effects = [shadow]
    const instance = component.createInstance()
    instance.rescale(2)
    expect(instance.children[0].effects[0].radius).toBe(16)
    instance.setExplicitVariableModeForCollection(collection, dark)
    expect(instance.children[0].effects[0].radius).toBe(48)

    const scaled = component.createInstance()
    scaled.rescale(3)
    scaled.effects = [shadow]
    expect(scaled.effects[0].radius).toBe(24)
  })
})

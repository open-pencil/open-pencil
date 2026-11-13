import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Accepted shapes, read-back values, and rejections were recorded by running the
// same assignments against a rectangle in live Figma through figma-use.

const color = { r: 0, g: 0, b: 0, a: 0.25 }
const shadow = {
  type: 'DROP_SHADOW',
  color,
  offset: { x: 0, y: 4 },
  radius: 8,
  visible: true,
  blendMode: 'NORMAL'
} as const

function createRectangle(graph = new SceneGraph()) {
  return new FigmaAPI(graph).createRectangle()
}

function assign(value: unknown) {
  const rect = createRectangle()
  // Scripts are untyped; the setter must check what it receives at runtime.
  Reflect.set(rect, 'effects', value)
  return rect
}

describe('node.effects', () => {
  test('reads a drop shadow back with Figma defaults', () => {
    expect(assign([shadow]).effects).toEqual([
      {
        type: 'DROP_SHADOW',
        visible: true,
        radius: 8,
        boundVariables: {},
        color,
        offset: { x: 0, y: 4 },
        spread: 0,
        blendMode: 'NORMAL',
        showShadowBehindNode: true
      }
    ])
  })

  test('keeps spread and showShadowBehindNode', () => {
    const [effect] = assign([{ ...shadow, spread: 2, showShadowBehindNode: false }]).effects
    expect(effect).toMatchObject({ spread: 2, showShadowBehindNode: false })
  })

  test('stores PASS_THROUGH on shadows as NORMAL', () => {
    for (const type of ['DROP_SHADOW', 'INNER_SHADOW'] as const) {
      const [effect] = assign([{ ...shadow, type, blendMode: 'PASS_THROUGH' }]).effects
      expect(effect).toMatchObject({ type, blendMode: 'NORMAL' })
    }
  })

  test('reads blurs back with blurType and without shadow fields', () => {
    expect(assign([{ type: 'LAYER_BLUR', radius: 4, visible: true }]).effects).toEqual([
      { type: 'LAYER_BLUR', visible: true, radius: 4, boundVariables: {}, blurType: 'NORMAL' }
    ])
    expect(
      assign([{ type: 'BACKGROUND_BLUR', blurType: 'NORMAL', radius: 4, visible: true }]).effects
    ).toEqual([
      { type: 'BACKGROUND_BLUR', visible: true, radius: 4, boundVariables: {}, blurType: 'NORMAL' }
    ])
  })

  test('reads a .fig foreground blur as a layer blur', () => {
    const graph = new SceneGraph()
    const rect = createRectangle(graph)
    graph.updateNode(rect.id, {
      effects: [
        {
          type: 'FOREGROUND_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 6,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(rect.effects[0]).toMatchObject({ type: 'LAYER_BLUR', radius: 6 })
  })

  test('accepts its own effects back', () => {
    const rect = assign([shadow, { type: 'LAYER_BLUR', radius: 4, visible: true }])
    const before = rect.effects
    // Assigning the live array back through the setter must not clear or duplicate it.
    const ownEffects = rect.effects
    rect.effects = ownEffects
    expect(rect.effects).toEqual(before)
  })

  test.each([
    ['missing required fields', [{ type: 'DROP_SHADOW', blur: 12 }]],
    ['a negative radius', [{ ...shadow, radius: -5 }]],
    ['a NaN radius', [{ ...shadow, radius: Number.NaN }]],
    ['an infinite radius', [{ ...shadow, radius: Number.POSITIVE_INFINITY }]],
    ['an infinite offset', [{ ...shadow, offset: { x: Number.POSITIVE_INFINITY, y: 0 } }]],
    ['an infinite spread', [{ ...shadow, spread: Number.NEGATIVE_INFINITY }]],
    [
      'an infinite blur radius',
      [{ type: 'LAYER_BLUR', radius: Number.POSITIVE_INFINITY, visible: true }]
    ],
    ['an unknown type', [{ type: 'NOT_AN_EFFECT' }]],
    ['a foreground blur', [{ type: 'FOREGROUND_BLUR', radius: 4, visible: true }]],
    ['an unknown key', [{ ...shadow, foo: 1 }]],
    ['a shadow without blendMode', [{ ...shadow, blendMode: undefined }]],
    ['an unknown blendMode', [{ ...shadow, blendMode: 'NOPE' }]],
    [
      'showShadowBehindNode on an inner shadow',
      [{ ...shadow, type: 'INNER_SHADOW', showShadowBehindNode: true }]
    ],
    [
      'shadow fields on a blur',
      [{ type: 'LAYER_BLUR', radius: 4, visible: true, color, offset: { x: 0, y: 0 }, spread: 0 }]
    ],
    ['a color without alpha', [{ ...shadow, color: { r: 0, g: 0, b: 0 } }]],
    ['a color channel above 1', [{ ...shadow, color: { r: 2, g: 0, b: 0, a: 1 } }]],
    ['an incomplete offset', [{ ...shadow, offset: { x: 0 } }]],
    ['a single effect instead of an array', shadow]
  ])('rejects %s without changing the node', (_name, value) => {
    const rect = assign([shadow])
    const before = rect.effects
    expect(() => Reflect.set(rect, 'effects', value)).toThrow(
      'Property "effects" failed validation'
    )
    expect(rect.effects).toEqual(before)
  })

  test('names the invalid field', () => {
    const message = (problem: string) =>
      `in set_effects: Property "effects" failed validation: ${problem}`
    expect(() => assign([{ ...shadow, radius: -5 }])).toThrow(
      message('Too small: expected number to be >=0 at [0].radius')
    )
    expect(() => assign([shadow, { ...shadow, foo: 1 }])).toThrow(
      message('Unrecognized key: "foo" at index 1')
    )
  })

  test('reports Figma effects OpenPencil does not model yet', () => {
    expect(() => assign([{ type: 'NOISE' }])).toThrow('NOISE effects are not supported')
  })
})

// Recorded on 2026-11-10 by assigning these effects in live Figma 126 through its plugin API.
describe('progressive blurs', () => {
  const progressive = {
    type: 'LAYER_BLUR',
    visible: true,
    blurType: 'PROGRESSIVE',
    radius: 10,
    startRadius: 2,
    startOffset: { x: 0.5, y: 0 },
    endOffset: { x: 0.5, y: 1 }
  } as const

  test('read back in Figma field order, layer and background alike', () => {
    for (const type of ['LAYER_BLUR', 'BACKGROUND_BLUR'] as const) {
      expect(assign([{ ...progressive, type }]).effects).toEqual([
        {
          type,
          visible: true,
          radius: 10,
          boundVariables: {},
          blurType: 'PROGRESSIVE',
          startRadius: 2,
          startOffset: { x: 0.5, y: 0 },
          endOffset: { x: 0.5, y: 1 }
        }
      ])
    }
  })

  test('keep a start radius over 100 at 100, any end radius, and offsets beyond the layer', () => {
    const [effect] = assign([
      {
        ...progressive,
        radius: 500,
        startRadius: 500,
        startOffset: { x: -0.5, y: 2 },
        endOffset: { x: 3, y: -1 }
      }
    ]).effects
    expect(effect).toMatchObject({
      radius: 500,
      startRadius: 100,
      startOffset: { x: -0.5, y: 2 },
      endOffset: { x: 3, y: -1 }
    })
  })

  test('need every progressive field, and a normal blur takes none of them', () => {
    const message = (problem: string) =>
      `in set_effects: Property "effects" failed validation: ${problem}`
    expect(() => assign([{ ...progressive, startRadius: -1 }])).toThrow(
      message('Too small: expected number to be >=0 at [0].startRadius')
    )
    for (const field of ['startRadius', 'startOffset', 'endOffset'] as const) {
      const { [field]: _, ...missing } = progressive
      expect(() => assign([missing])).toThrow('set_effects')
    }
    expect(() =>
      assign([{ type: 'LAYER_BLUR', visible: true, blurType: 'NORMAL', radius: 4, startRadius: 2 }])
    ).toThrow(message('Unrecognized key: "startRadius" at index 0'))
  })

  test('survive a radius binding', () => {
    const api = new FigmaAPI(new SceneGraph())
    const collection = api.variables.createVariableCollection('Blur')
    const size = api.variables.createVariable('End', collection, 'FLOAT')
    expect(api.variables.setBoundVariableForEffect(progressive, 'radius', size)).toEqual({
      type: 'LAYER_BLUR',
      visible: true,
      radius: 10,
      boundVariables: { radius: { type: 'VARIABLE_ALIAS', id: size.id } },
      blurType: 'PROGRESSIVE',
      startRadius: 2,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 }
    })
  })
})

// Recorded on 2026-11-09 by assigning these effects in live Figma 126 through its plugin API.
describe('glass effects', () => {
  const glass = {
    type: 'GLASS',
    visible: true,
    refraction: 0.5,
    depth: 20,
    lightAngle: -45,
    lightIntensity: 0.5,
    dispersion: 0.25,
    radius: 4
  } as const
  const red = (opacity: number, visible = true) => ({
    type: 'SOLID' as const,
    color: { r: 1, g: 0, b: 0 },
    opacity,
    visible
  })
  const opacities = (rect: { fills: unknown }) =>
    (rect.fills as { opacity: number }[]).map((fill) => fill.opacity)

  test('reads back in Figma field order', () => {
    expect(assign([glass]).effects).toEqual([
      {
        type: 'GLASS',
        visible: true,
        radius: 4,
        boundVariables: {},
        refraction: 0.5,
        depth: 20,
        lightAngle: -45,
        lightIntensity: 0.5,
        dispersion: 0.25
      }
    ])
  })

  test('keeps a depth outside 1 to 100 at the nearer end and any light angle', () => {
    expect(assign([{ ...glass, depth: 0.5 }]).effects[0]).toMatchObject({ depth: 1 })
    expect(assign([{ ...glass, depth: 1000 }]).effects[0]).toMatchObject({ depth: 100 })
    expect(assign([{ ...glass, lightAngle: -400 }]).effects[0]).toMatchObject({ lightAngle: -400 })
  })

  test('names the field Figma refuses', () => {
    const message = (problem: string) =>
      `in set_effects: Property "effects" failed validation: ${problem}`
    expect(() => assign([{ ...glass, refraction: 1.5 }])).toThrow(
      message('Too big: expected number to be <=1 at [0].refraction')
    )
    expect(() => assign([{ ...glass, lightIntensity: 2 }])).toThrow(
      message('Too big: expected number to be <=1 at [0].lightIntensity')
    )
    expect(() => assign([{ ...glass, dispersion: 2 }])).toThrow(
      message('Too big: expected number to be <=1 at [0].dispersion')
    )
    expect(() => assign([{ ...glass, radius: -1 }])).toThrow(
      message('Too small: expected number to be >=0 at [0].radius')
    )
    expect(() => assign([{ ...glass, blendMode: 'NORMAL' }])).toThrow(
      message('Unrecognized key: "blendMode" at index 0')
    )
    expect(() => assign([glass, { ...glass, depth: 5 }])).toThrow(
      message('Only one glass effect is allowed per node.')
    )
  })

  test('turns a single opaque fill to 20%, or 10% when it is white, as it gains glass', () => {
    const rect = createRectangle()
    rect.fills = [red(1)]
    rect.effects = [glass]
    expect(opacities(rect)).toEqual([0.2])

    const white = createRectangle()
    white.fills = [{ type: 'SOLID', color: { r: 0.999, g: 0.999, b: 0.999 }, opacity: 1 }]
    white.effects = [glass]
    expect(opacities(white)).toEqual([0.1])

    const hidden = createRectangle()
    hidden.fills = [red(1, false)]
    hidden.effects = [shadow]
    hidden.effects = [shadow, glass]
    expect(opacities(hidden)).toEqual([0.2])
  })

  test('leaves other fills, and a layer that had glass, as they are', () => {
    const cases: [unknown[], unknown[]][] = [
      [[red(0.99)], []],
      [[red(1), red(1)], []],
      [[], []],
      [[red(1)], [{ ...glass, visible: false }]]
    ]
    for (const [fills, before] of cases) {
      const rect = createRectangle()
      Reflect.set(rect, 'effects', before)
      Reflect.set(rect, 'fills', fills)
      const kept = opacities(rect)
      rect.effects = [glass]
      expect(opacities(rect)).toEqual(kept)
    }
  })

  test('binds only the frost radius', () => {
    const api = new FigmaAPI(new SceneGraph())
    const collection = api.variables.createVariableCollection('Glass')
    const size = api.variables.createVariable('Frost', collection, 'FLOAT')
    expect(api.variables.setBoundVariableForEffect(glass, 'radius', size)).toEqual({
      type: 'GLASS',
      visible: true,
      radius: 4,
      boundVariables: { radius: { type: 'VARIABLE_ALIAS', id: size.id } },
      refraction: 0.5,
      depth: 20,
      lightAngle: -45,
      lightIntensity: 0.5,
      dispersion: 0.25
    })
    expect(() => api.variables.setBoundVariableForEffect(glass, 'spread', size)).toThrow(
      'in setBoundVariableForEffect: Property "field" failed validation: Invalid input: expected "radius"'
    )
  })
})

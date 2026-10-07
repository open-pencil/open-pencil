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
    expect(() => assign([{ ...shadow, radius: -5 }])).toThrow('at [0].radius')
    expect(() => assign([shadow, { ...shadow, foo: 1 }])).toThrow('[1]')
  })

  test('reports Figma effects OpenPencil does not model yet', () => {
    expect(() => assign([{ type: 'NOISE' }])).toThrow('NOISE effects are not supported')
    expect(() =>
      assign([{ type: 'LAYER_BLUR', blurType: 'PROGRESSIVE', radius: 4, visible: true }])
    ).toThrow('Progressive blur is not supported')
  })
})

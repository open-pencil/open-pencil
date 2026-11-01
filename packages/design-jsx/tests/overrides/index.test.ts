import { describe, expect, test } from 'bun:test'

import { designJSXProp } from '#design-jsx/index'
import { propsToOverrides } from '#design-jsx/overrides/index'

import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'

describe('property names', () => {
  test('reads the first name of a property that is set', () => {
    expect(designJSXProp({ width: 10 }, 'w')).toBe(10)
    expect(designJSXProp({ w: 20, width: 10 }, 'w')).toBe(20)
    expect(designJSXProp({ fill: '#000', backgroundColor: '#FFF' }, 'bg')).toBe('#000')
  })

  test('an attribute under any of its names wins over style', () => {
    const overrides = propsToOverrides(
      { width: 100, style: { width: '200px', height: '50px', borderRadius: 8 } },
      false,
      'NONE'
    )

    expect(overrides).toMatchObject({ width: 100, height: 50, cornerRadius: 8 })
  })
})

describe('stack alignment', () => {
  test('CSS justify and align keywords mean what the short names do', () => {
    expect(
      propsToOverrides({ flex: 'row', justifyContent: 'space-between' }, false, 'NONE')
    ).toMatchObject({
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    expect(propsToOverrides({ flex: 'row', justify: 'between' }, false, 'NONE')).toMatchObject({
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    expect(propsToOverrides({ flex: 'row', alignItems: 'flex-end' }, false, 'NONE')).toMatchObject({
      counterAxisAlign: 'MAX'
    })
  })

  test('items can align children by their baseline', () => {
    expect(propsToOverrides({ flex: 'row', items: 'baseline' }, false, 'NONE')).toMatchObject({
      counterAxisAlign: 'BASELINE'
    })
  })
})

// A paint written as an object, as export writes an image, gives its transforms as Figma's rows or
// as the matrix fields earlier exports printed.
describe('paints written as objects', () => {
  const gradient = {
    type: 'GRADIENT_LINEAR',
    color: { r: 0, g: 0, b: 0, a: 0 },
    opacity: 1,
    visible: true,
    gradientStops: []
  }
  const image = {
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: 'abc123',
    imageScaleMode: 'CROP'
  }
  const crop = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }

  function fills(...paints: object[]) {
    return propsToOverrides({ fills: paints }, false, 'NONE').fills
  }

  test("read a transform given as Figma's rows or as the matrix fields", () => {
    const rows = {
      gradientTransform: [
        [0, 1, 0],
        [-1, 0, 1]
      ]
    }
    const cropRows = {
      imageTransform: [
        [0.5, 0, 0.25],
        [0, 0.5, 0.25]
      ]
    }
    expect(fills({ ...gradient, ...rows }, { ...image, ...cropRows })).toEqual([
      expect.objectContaining({ gradientTransform: DEFAULT_GRADIENT_TRANSFORM }),
      expect.objectContaining({ imageTransform: crop })
    ])
    expect(fills({ ...image, imageTransform: crop })).toEqual([
      expect.objectContaining({ imageTransform: crop })
    ])
  })

  test('refuse a transform that is neither and name both forms', () => {
    expect(() => fills({ ...image, imageTransform: [[1, 0, 0]] })).toThrow(
      "A paint's imageTransform expects Figma's [[a, b, c], [d, e, f]] or { m00, m01, m02, m10, m11, m12 }:\n× Expected [[a, b, c], [d, e, f]] or { m00, m01, m02, m10, m11, m12 } but received Array"
    )
  })
})

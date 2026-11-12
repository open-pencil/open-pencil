import { describe, expect, test } from 'bun:test'

import { designJSXProp } from '#design-jsx/index'
import { propsToOverrides, shapeOverrides } from '#design-jsx/overrides/index'

import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'
import {
  MAX_GRID_TRACKS,
  MAX_LAYOUT_LENGTH,
  MAX_LAYOUT_SPACING
} from '@open-pencil/scene-graph/layout'

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

describe('grid placement', () => {
  test('places a child by its start line, under either name', () => {
    expect(propsToOverrides({ colStart: 2, rowStart: 3 }, false, 'GRID')).toMatchObject({
      gridPosition: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 }
    })
    expect(propsToOverrides({ col: 4, row: 5 }, false, 'GRID')).toMatchObject({
      gridPosition: { column: 4, row: 5, columnSpan: 1, rowSpan: 1 }
    })
  })

  test('spans the tracks a child names, and at least one', () => {
    expect(propsToOverrides({ colStart: 1, colSpan: 3, rowSpan: 2 }, false, 'GRID')).toMatchObject({
      gridPosition: { columnSpan: 3, rowSpan: 2 }
    })
    expect(propsToOverrides({ colStart: 1, colSpan: 0 }, false, 'GRID')).toMatchObject({
      gridPosition: { columnSpan: 1 }
    })
  })

  test('refuses a track count layout would allocate one entry per track for', () => {
    expect(
      propsToOverrides({ grid: true, columns: 1_000_000_000 }, false, 'NONE').gridTemplateColumns
    ).toBeUndefined()
  })

  test('keeps a track list to the tracks layout can place', () => {
    const columns = Array.from({ length: MAX_GRID_TRACKS + 5 }, () => '1fr').join(' ')
    const overrides = propsToOverrides({ grid: true, columns }, false, 'NONE')
    expect(overrides.gridTemplateColumns).toHaveLength(MAX_GRID_TRACKS)
  })

  test('keeps a size within what layout can draw', () => {
    expect(propsToOverrides({ w: 1_000_000_000 }, false, 'NONE').width).toBe(MAX_LAYOUT_LENGTH)
  })
})

describe('layout bounds', () => {
  test('keeps a negative gap and padding, which overlap children', () => {
    expect(propsToOverrides({ flex: 'row', gap: -8, p: -4 }, false, 'NONE')).toMatchObject({
      itemSpacing: -8,
      paddingTop: -4
    })
    expect(propsToOverrides({ grid: true, gap: -1e9 }, false, 'NONE').gridColumnGap).toBe(
      -MAX_LAYOUT_SPACING
    )
  })

  test('leaves a layer in the flow when its position is not a number layout can use', () => {
    const overrides = propsToOverrides({ x: Number.POSITIVE_INFINITY }, false, 'HORIZONTAL')
    expect(overrides.x).toBeUndefined()
    expect(overrides.layoutPositioning).toBeUndefined()
    expect(propsToOverrides({ x: 10 }, false, 'HORIZONTAL').layoutPositioning).toBe('ABSOLUTE')
  })

  test('draws a polygon with at least three points', () => {
    expect(shapeOverrides('POLYGON', { points: 1 }).pointCount).toBe(3)
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

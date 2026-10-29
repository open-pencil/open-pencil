import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { lineHeightPixels, percentLength, pixelLength } from '@open-pencil/scene-graph/text'

import { registerTestFont } from '#core-tests/helpers/figma-api'

beforeAll(() => registerTestFont())

function text() {
  const graph = new SceneGraph()
  const node = new FigmaAPI(graph).createText()
  node.fontSize = 20
  return { graph, node, raw: () => expectDefined(graph.getNode(node.id)) }
}

// Recorded in Figma 126: line height and letter spacing read and write as { unit, value }, and a
// percent stays a percent of the font size when the size changes.
describe('text units in the plugin API', () => {
  test('line height takes pixels, percent of the font size, and auto', () => {
    const { node, raw } = text()
    node.lineHeight = { unit: 'PIXELS', value: 22 }
    expect(raw().lineHeight).toEqual(pixelLength(22))
    expect(node.lineHeight).toEqual({ unit: 'PIXELS', value: 22 })

    node.lineHeight = { unit: 'PERCENT', value: 150 }
    expect(node.lineHeight).toEqual({ unit: 'PERCENT', value: 150 })
    node.fontSize = 40
    expect(node.lineHeight).toEqual({ unit: 'PERCENT', value: 150 })
    expect(lineHeightPixels(raw().lineHeight, raw().fontSize)).toBe(60)

    node.lineHeight = { unit: 'AUTO' }
    expect(raw().lineHeight).toBeNull()
    expect(node.lineHeight).toEqual({ unit: 'AUTO' })
  })

  test('letter spacing takes pixels and percent of the font size, and keeps the percent', () => {
    const { node, raw } = text()
    node.letterSpacing = { unit: 'PERCENT', value: 10 }
    node.fontSize = 40
    expect(raw().letterSpacing).toEqual(percentLength(10))
    expect(node.letterSpacing).toEqual({ unit: 'PERCENT', value: 10 })
    node.letterSpacing = { unit: 'PIXELS', value: 2 }
    expect(node.letterSpacing).toEqual({ unit: 'PIXELS', value: 2 })
  })

  test('a new text has no letter spacing, in percent', () => {
    expect(text().node.letterSpacing).toEqual({ unit: 'PERCENT', value: 0 })
  })

  test('lengths Figma refuses throw its messages', () => {
    const { node } = text()
    const set = (field: 'lineHeight' | 'letterSpacing', value: unknown) => () =>
      Reflect.set(node, field, value)
    expect(set('lineHeight', { unit: 'RAW', value: 1.5 })).toThrow(
      'in set_lineHeight: Property "lineHeight" failed validation: Expected .unit to be one of the following: PIXELS, PERCENT, AUTO'
    )
    expect(set('lineHeight', { unit: 'PIXELS' })).toThrow(
      'in set_lineHeight: Property "lineHeight" failed validation: Required value missing at .value'
    )
    expect(set('lineHeight', '24')).toThrow(
      'in set_lineHeight: Property "lineHeight" failed validation: Expected object, received string'
    )
    expect(set('letterSpacing', { unit: 'AUTO' })).toThrow(
      'in set_letterSpacing: Property "letterSpacing" failed validation: Required value missing at .value\nInvalid option: expected one of "PIXELS"|"PERCENT" at .unit'
    )
    expect(set('lineHeight', { unit: 'PIXELS', value: Number.NaN })).toThrow(
      'in set_lineHeight: Property "lineHeight" failed validation: Expected number, received nan at .value'
    )
    expect(set('letterSpacing', { unit: 'RAW', value: 1 })).toThrow(
      'in set_letterSpacing: Property "letterSpacing" failed validation: Invalid option: expected one of "PIXELS"|"PERCENT" at .unit'
    )
  })

  // Plugin typings allow only the object; untyped eval scripts may still pass a number.
  test('a bare number still sets pixels and null automatic, as earlier OpenPencil scripts wrote them', () => {
    const { node, raw } = text()
    Reflect.set(node, 'lineHeight', 18)
    Reflect.set(node, 'letterSpacing', 1)
    expect(raw()).toMatchObject({ lineHeight: pixelLength(18), letterSpacing: pixelLength(1) })
    Reflect.set(node, 'lineHeight', null)
    expect(raw().lineHeight).toBeNull()
  })
})

import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'

import { getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

const RED = { r: 1, g: 0, b: 0, a: 1 }

function rectangle(fields: Partial<PenNode>): PenNode {
  return { id: 'shape', type: 'rectangle', width: 100, height: 80, ...fields }
}

function strokeOf(fields: Partial<PenNode>) {
  return getNodeOrThrow(parseDocument([rectangle(fields)]), 'shape')
}

describe('parsePenFile — strokes (#1324)', () => {
  test('reads a stroke paint with a sibling width, centred by default', () => {
    const node = strokeOf({ stroke: '#FF0000', strokeWidth: 4 })
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0]).toMatchObject({ type: 'SOLID', color: RED, weight: 4, align: 'CENTER' })
  })

  test('draws no stroke without a width, nor a width without a paint', () => {
    expect(strokeOf({ stroke: '#FF0000' }).strokes).toEqual([])
    expect(strokeOf({ strokeWidth: 4 }).strokes).toEqual([])
  })

  test('maps inner and outer alignment', () => {
    expect(
      strokeOf({ stroke: '#F00', strokeWidth: 2, strokeAlignment: 'inner' }).strokes[0]?.align
    ).toBe('INSIDE')
    expect(
      strokeOf({ stroke: '#F00', strokeWidth: 2, strokeAlignment: 'outer' }).strokes[0]?.align
    ).toBe('OUTSIDE')
  })

  test('stacks a list of stroke paints, the last on top', () => {
    const node = strokeOf({ stroke: ['#FF0000', '#0000FF80'], strokeWidth: 4 })
    expect(node.strokes.map((stroke) => stroke.color)).toEqual([
      RED,
      { r: 0, g: 0, b: 1, a: 128 / 255 }
    ])
    expect(node.strokes.every((stroke) => stroke.weight === 4)).toBe(true)
  })

  test('reads per-side widths, a missing side being zero', () => {
    const node = strokeOf({ stroke: '#F00', strokeWidth: { top: 2, right: 8, left: 4 } })
    expect(node.independentStrokeWeights).toBe(true)
    expect([
      node.borderTopWeight,
      node.borderRightWeight,
      node.borderBottomWeight,
      node.borderLeftWeight
    ]).toEqual([2, 8, 0, 4])
    expect(node.strokes[0]?.weight).toBe(8)
  })

  test('reads caps and joins', () => {
    const node = strokeOf({
      stroke: '#000',
      strokeWidth: 10,
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel'
    })
    expect(node.strokeCap).toBe('ROUND')
    expect(node.strokeJoin).toBe('BEVEL')
  })

  test('skips a disabled stroke paint by hiding it', () => {
    const node = strokeOf({
      stroke: { type: 'color', color: '#F00', enabled: false },
      strokeWidth: 2
    })
    expect(node.strokes[0]?.visible).toBe(false)
  })

  test('still reads the 2.8 object form', () => {
    const node = strokeOf({
      stroke: { align: 'inside', thickness: { bottom: 1 }, fill: '#FF0000' }
    })
    expect(node.strokes[0]).toMatchObject({ color: RED, align: 'INSIDE', weight: 1 })
    expect(node.borderBottomWeight).toBe(1)
  })

  test('resolves and binds a variable width', () => {
    const graph = parseDocument([rectangle({ stroke: '#F00', strokeWidth: '$w' })], {
      variables: { w: { type: 'number', value: 3 } }
    })
    const node = getNodeOrThrow(graph, 'shape')
    expect(node.strokes[0]?.weight).toBe(3)
    expect(node.boundVariables.strokeWeight).toBeDefined()
  })

  test('lets an instance replace its component stroke field by field', () => {
    const graph = parseDocument([
      {
        id: 'button',
        type: 'frame',
        reusable: true,
        width: 80,
        height: 30,
        stroke: '#001155',
        strokeWidth: 2,
        strokeAlignment: 'inner'
      },
      { id: 'recoloured', type: 'ref', ref: 'button', stroke: '#FF0000' }
    ])
    expect(getNodeOrThrow(graph, 'recoloured').strokes[0]).toMatchObject({
      color: RED,
      weight: 2,
      align: 'INSIDE'
    })
  })
})

import { describe, expect, test } from 'bun:test'

import { linearGradient, radialGradient } from '@open-pencil/design-jsx'
import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'

const expected =
  "linearGradient() expects an array of stops, such as [['#3b82f6', 0], ['#8b5cf6', 1]]"

const stops: [string, number][] = [
  ['#3b82f6', 0],
  ['#8b5cf6', 1]
]

const transformExpected =
  "linearGradient() expects a transform as Figma's [[a, b, c], [d, e, f]], such as [[0, 1, 0], [-1, 0, 1]], or { m00, m01, m02, m10, m11, m12 }"

describe('gradient helpers', () => {
  // Figma's plugin API gives a paint's transform as two rows, and its default gradient runs top to
  // bottom: [[0, 1, 0], [-1, 0, 1]]. Earlier design JSX exports printed the matrix fields.
  test("take a transform as Figma's rows or as the matrix fields", () => {
    const rows = linearGradient(stops, {
      transform: [
        [0, 1, 0],
        [-1, 0, 1]
      ]
    })
    expect(rows.gradientTransform).toEqual(DEFAULT_GRADIENT_TRANSFORM)
    const transform = { m00: 2, m01: 0, m02: -0.5, m10: 0, m11: 1, m12: 0.2 }
    expect(linearGradient(stops, { transform }).gradientTransform).toEqual(transform)
  })

  test.each([
    ['one row', [[0, 1, 0]], 'Array'],
    [
      'a third row',
      [
        [0, 1, 0],
        [-1, 0, 1],
        [0, 0, 1]
      ],
      'Array'
    ],
    [
      'a fourth value in a row',
      [
        [0, 1, 0, 9],
        [-1, 0, 1]
      ],
      'Array'
    ],
    ['a missing field', { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1 }, 'Object'],
    ['a surplus field', { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0, m20: 0 }, 'Object']
  ])('refuse a transform with %s and name both forms', (_, transform, received) => {
    expect(() => linearGradient(stops, { transform: transform as never })).toThrow(
      `${transformExpected}:\n× Expected [[a, b, c], [d, e, f]] or { m00, m01, m02, m10, m11, m12 } but received ${received}`
    )
  })

  test('refuse a transform that is not finite', () => {
    expect(() =>
      linearGradient(stops, {
        transform: [
          [Number.POSITIVE_INFINITY, 0, 0],
          [0, 1, 0]
        ]
      })
    ).toThrow(transformExpected)
  })

  test('accept tuple and object stops', () => {
    const fill = linearGradient([['#000000', 0], { color: '#ffffff', position: 1 }])
    expect(fill.gradientStops?.map((stop) => stop.position)).toEqual([0, 1])
  })

  const circular: Record<string, unknown> = {}
  circular.self = circular

  test.each([
    ['#3b82f6', '"#3b82f6"'],
    [{ stops: [] }, 'Object'],
    [undefined, 'undefined'],
    [10n, '10'],
    [circular, 'Object']
  ])('say what they expect when the stops are not an array (%p)', (stops, received) => {
    expect(() => linearGradient(stops as never)).toThrow(
      `${expected}:\n× Invalid type: Expected Array but received ${received}`
    )
  })

  test('name the stop that is wrong and what it was', () => {
    expect(() => radialGradient([['#000000', 0], ['#ffffff']] as never)).toThrow(
      "radialGradient() expects an array of stops, such as [['#3b82f6', 0], ['#8b5cf6', 1]]:\n× Expected [color, position] or { color, position } but received Array\n  → at 1"
    )
  })
})

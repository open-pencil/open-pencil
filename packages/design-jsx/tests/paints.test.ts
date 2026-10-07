import { describe, expect, test } from 'bun:test'

import { linearGradient, radialGradient } from '@open-pencil/design-jsx'

const expected =
  "linearGradient() expects an array of stops, such as [['#3b82f6', 0], ['#8b5cf6', 1]]"

describe('gradient helpers', () => {
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

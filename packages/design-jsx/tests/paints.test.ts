import { describe, expect, test } from 'bun:test'

import { linearGradient, radialGradient } from '@open-pencil/design-jsx'

describe('gradient helpers', () => {
  test('accept tuple and object stops', () => {
    const fill = linearGradient([['#000000', 0], { color: '#ffffff', position: 1 }])
    expect(fill.gradientStops?.map((stop) => stop.position)).toEqual([0, 1])
  })

  test.each([
    ['#3b82f6', /linearGradient expects an array of stops.*; got "#3b82f6"/],
    [{ stops: [] }, /linearGradient expects an array of stops.*; got \{"stops":\[\]\}/],
    [undefined, /linearGradient expects an array of stops.*; got undefined/]
  ])('say what they expect when the stops are not an array (%p)', (stops, message) => {
    expect(() => linearGradient(stops as never)).toThrow(message)
  })

  test('name the stop that is wrong', () => {
    expect(() => radialGradient([['#000000', 0], ['#ffffff']] as never)).toThrow(
      /radialGradient expects an array of stops.*; stop 1 is invalid/
    )
  })
})

import { describe, expect, test } from 'bun:test'

import { computeMeasurementSegments } from '#core/canvas/overlays/measurement'

const rect = (x: number, y: number, width = 20, height = 20) => ({ x, y, width, height })

describe('distance measurement geometry', () => {
  test('measures horizontal and vertical gaps between separated bounds', () => {
    expect(computeMeasurementSegments(rect(0, 0), rect(30, 40))).toEqual([
      { axis: 'x', from: 20, to: 30, cross: 20, value: 10 },
      { axis: 'y', from: 20, to: 40, cross: 30, value: 20 }
    ])
  })

  test('anchors diagonal guides to the nearest corners', () => {
    expect(computeMeasurementSegments(rect(120, 140, 100, 80), rect(300, 290, 120, 90))).toEqual([
      { axis: 'x', from: 220, to: 300, cross: 220, value: 80 },
      { axis: 'y', from: 220, to: 290, cross: 300, value: 70 }
    ])
  })

  test('measures from facing edges in either direction', () => {
    expect(computeMeasurementSegments(rect(40, 50), rect(0, 10))).toEqual([
      { axis: 'x', from: 20, to: 40, cross: 50, value: 20 },
      { axis: 'y', from: 30, to: 50, cross: 20, value: 20 }
    ])
  })

  test('only measures the separated axis when bounds overlap', () => {
    expect(computeMeasurementSegments(rect(0, 0), rect(30, 10))).toEqual([
      { axis: 'x', from: 20, to: 30, cross: 15, value: 10 }
    ])
  })

  test('measures all four edges for a child inside a container', () => {
    expect(computeMeasurementSegments(rect(20, 30, 40, 50), rect(0, 0, 100, 120))).toEqual([
      { axis: 'x', from: 0, to: 20, cross: 55, value: 20 },
      { axis: 'x', from: 60, to: 100, cross: 55, value: 40 },
      { axis: 'y', from: 0, to: 30, cross: 40, value: 30 },
      { axis: 'y', from: 80, to: 120, cross: 40, value: 40 }
    ])
  })

  test('does not measure overlap on either axis', () => {
    expect(computeMeasurementSegments(rect(0, 0, 40, 40), rect(20, 20, 40, 40))).toEqual([])
  })

  test('preserves fractional geometry for display rounding', () => {
    const [segment] = computeMeasurementSegments(rect(0.2, 0, 10.1, 10), rect(20.8, 0, 10, 10))
    expect(segment).toMatchObject({ axis: 'x', to: 20.8, cross: 5 })
    expect(segment?.from).toBeCloseTo(10.3)
    expect(segment?.value).toBeCloseTo(10.5)
  })

  test('omits zero gaps for touching and identical bounds', () => {
    expect(computeMeasurementSegments(rect(0, 0), rect(20, 0))).toEqual([])
    expect(computeMeasurementSegments(rect(0, 0), rect(0, 0))).toEqual([])
  })
})

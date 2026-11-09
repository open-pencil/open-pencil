import { describe, expect, test } from 'bun:test'

import { measuredSize } from '#core/layout/measured-size'

const fallback = () => ({ width: 80, height: 20 })

describe('measuredSize', () => {
  test('reports a measurement that throws as the size the text has', () => {
    const size = measuredSize(fallback, () => {
      throw new Error('measure failed')
    })
    expect(size).toEqual({ width: 80, height: 20 })
  })

  test('keeps the text size when the measurement is not finite', () => {
    expect(measuredSize(fallback, () => ({ width: Number.POSITIVE_INFINITY, height: 20 }))).toEqual(
      { width: 80, height: 20 }
    )
  })

  test('bounds a stored size the fallback itself reports', () => {
    const stored = () => ({ width: Number.POSITIVE_INFINITY, height: 20 })
    const size = measuredSize(stored, () => {
      throw new Error('measure failed')
    })
    expect(Number.isFinite(size.width)).toBe(true)
    expect(size).toEqual({ width: 0, height: 20 })
  })

  test('bounds a measured size to what layout can place', () => {
    const size = measuredSize(fallback, () => ({ width: 4_000_000, height: 20 }))
    expect(size).toEqual({ width: 1_000_000, height: 20 })
  })
})

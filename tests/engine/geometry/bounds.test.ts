import { describe, test, expect } from 'bun:test'

import { computeAbsoluteBounds, computeBounds, type Vector } from '@open-pencil/core'

describe('computeBounds', () => {
  test('empty iterable returns zero rect', () => {
    expect(computeBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('single rect returns itself', () => {
    const r = { x: 10, y: 20, width: 30, height: 40 }
    expect(computeBounds([r])).toEqual(r)
  })

  test('multiple rects returns union', () => {
    const result = computeBounds([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 150, height: 150 })
  })

  test('disjoint rects returns union spanning both', () => {
    const result = computeBounds([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 }
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 110, height: 110 })
  })
})

describe('computeAbsoluteBounds', () => {
  const idPos = (id: string) => {
    const map: Record<string, Vector> = {
      a: { x: 10, y: 20 },
      b: { x: 50, y: 60 },
      c: { x: 0, y: 0 }
    }
    return map[id] ?? { x: 0, y: 0 }
  }

  test('empty iterable returns zero rect', () => {
    expect(computeAbsoluteBounds([], idPos)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('single node returns its bounds', () => {
    const result = computeAbsoluteBounds([{ id: 'a', width: 30, height: 40 }], idPos)
    expect(result).toEqual({ x: 10, y: 20, width: 30, height: 40 })
  })

  test('multiple nodes returns union', () => {
    const result = computeAbsoluteBounds(
      [
        { id: 'a', width: 30, height: 40 },
        { id: 'b', width: 20, height: 20 }
      ],
      idPos
    )
    expect(result).toEqual({ x: 10, y: 20, width: 60, height: 60 })
  })
})


import { describe, test, expect } from 'bun:test'

import { computeSnap, computeSelectionBounds, type SceneNode } from '@open-pencil/core'

function node(overrides: Partial<SceneNode> & { id: string }): SceneNode {
  return { x: 0, y: 0, width: 100, height: 100, rotation: 0, ...overrides } as SceneNode
}

describe('computeSelectionBounds', () => {
  test('empty array returns null', () => {
    expect(computeSelectionBounds([])).toBeNull()
  })

  test('single node', () => {
    const bounds = computeSelectionBounds([node({ id: 'a', x: 10, y: 20, width: 100, height: 50 })])
    expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })

  test('two nodes gives union', () => {
    const bounds = computeSelectionBounds([
      node({ id: 'a', x: 0, y: 0, width: 50, height: 50 }),
      node({ id: 'b', x: 100, y: 100, width: 50, height: 50 })
    ])
    expect(bounds).toEqual({ x: 0, y: 0, width: 150, height: 150 })
  })

  test('rotated node expands bbox', () => {
    const bounds = computeSelectionBounds([
      node({ id: 'a', x: 0, y: 0, width: 100, height: 0, rotation: 45 })
    ])!
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })
})

describe('computeSnap', () => {
  test('no targets returns zero', () => {
    const result = computeSnap(
      new Set(['moving']),
      { x: 50, y: 50, width: 100, height: 100 },
      [node({ id: 'moving' })]
    )
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
    expect(result.guides).toHaveLength(0)
  })

  test('snaps to aligned left edge', () => {
    const target = node({ id: 'target', x: 100, y: 200, width: 50, height: 50 })
    const result = computeSnap(
      new Set(['moving']),
      { x: 102, y: 50, width: 80, height: 80 },
      [node({ id: 'moving' }), target]
    )
    expect(result.dx).toBe(-2)
  })

  test('snaps to aligned top edge', () => {
    const target = node({ id: 'target', x: 200, y: 100, width: 50, height: 50 })
    const result = computeSnap(
      new Set(['moving']),
      { x: 50, y: 103, width: 80, height: 80 },
      [node({ id: 'moving' }), target]
    )
    expect(result.dy).toBe(-3)
  })

  test('no snap when far away', () => {
    const target = node({ id: 'target', x: 500, y: 500, width: 50, height: 50 })
    const result = computeSnap(
      new Set(['moving']),
      { x: 0, y: 0, width: 50, height: 50 },
      [node({ id: 'moving' }), target]
    )
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })

  test('center-to-center snap', () => {
    // target center at x=50, moving center at x=-2+50=48 → dx=+2
    const target = node({ id: 'target', x: 0, y: 0, width: 100, height: 100 })
    const result = computeSnap(
      new Set(['moving']),
      { x: -2, y: 300, width: 100, height: 100 },
      [node({ id: 'moving' }), target]
    )
    expect(result.dx).toBe(2)
  })
})

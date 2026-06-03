import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: transforms', () => {
  test('flipped transforms use their visual bounds', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('VECTOR', 10, 1, {
        size: { x: 17, y: 36 },
        transform: { m00: -1, m01: 0, m02: 70, m10: 0, m11: 1, m12: 7 }
      })
    ])
    const imported = graph.getChildren(graph.getPages()[0].id)[0]

    expect(imported.x).toBe(53)
    expect(imported.y).toBe(7)
    expect(imported.flipX).toBe(true)
  })

  test('rotated transforms preserve the Figma matrix origin', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('VECTOR', 10, 1, {
        size: { x: 100, y: 20 },
        transform: { m00: 0, m01: -1, m02: 10, m10: 1, m11: 0, m12: 20 }
      })
    ])
    const imported = graph.getChildren(graph.getPages()[0].id)[0]

    expect(imported.x).toBeCloseTo(-50)
    expect(imported.y).toBeCloseTo(60)
    expect(imported.rotation).toBeCloseTo(90)
  })
})

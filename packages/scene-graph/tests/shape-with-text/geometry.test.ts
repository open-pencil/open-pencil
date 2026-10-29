import { describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/scene-graph/primitives'
import type { PolygonOutlineCommand } from '@open-pencil/scene-graph/polygon'
import { SHAPE_WITH_TEXT_TYPES, shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'

function points(commands: PolygonOutlineCommand[]): Vector[] {
  return commands.flatMap((command) => {
    if (command.type === 'Z') return []
    if (command.type === 'C') {
      return [
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        { x: command.x, y: command.y }
      ]
    }
    return [{ x: command.x, y: command.y }]
  })
}

describe('shape-with-text geometry', () => {
  for (const type of SHAPE_WITH_TEXT_TYPES) {
    test(`${type} is one closed outline inside its box`, () => {
      const { outline, details } = shapeWithTextGeometry(type, 200, 100)
      expect(outline[0]?.type).toBe('M')
      expect(outline.at(-1)?.type).toBe('Z')
      expect(outline.filter((command) => command.type === 'M')).toHaveLength(1)
      for (const point of [...points(outline), ...points(details)]) {
        expect(point.x).toBeGreaterThanOrEqual(-1e-9)
        expect(point.x).toBeLessThanOrEqual(200 + 1e-9)
        expect(point.y).toBeGreaterThanOrEqual(-1e-9)
        expect(point.y).toBeLessThanOrEqual(100 + 1e-9)
      }
    })
  }

  test('a diamond reaches the middle of each side and nothing else', () => {
    const { outline } = shapeWithTextGeometry('DIAMOND', 200, 100)
    expect(points(outline)).toEqual([
      { x: 100, y: 0 },
      { x: 200, y: 50 },
      { x: 100, y: 100 },
      { x: 0, y: 50 }
    ])
  })

  test('a database draws its front rim as a stroke-only detail', () => {
    const { details } = shapeWithTextGeometry('ENG_DATABASE', 120, 160)
    expect(details[0]).toEqual({ type: 'M', x: 0, y: 24 })
    expect(details.at(-1)).toMatchObject({ type: 'C', x: 120, y: 24 })
  })
})

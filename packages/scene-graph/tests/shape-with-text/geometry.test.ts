import { describe, expect, test } from 'bun:test'

import type { Stroke } from '@open-pencil/scene-graph'
import type { PolygonOutlineCommand } from '@open-pencil/scene-graph/polygon'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  SHAPE_WITH_TEXT_TYPES,
  shapeWithTextCutsFill,
  shapeWithTextGeometry
} from '@open-pencil/scene-graph/shape-with-text'

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

  test('a folder is a tab over a body, the line between them its inner line', () => {
    // FigJam's SVG export of a 176 × 112 folder: the tab is 44 high and its base ends 13 past
    // the middle; the corners where tab and body meet stay sharp.
    const { outline, details } = shapeWithTextGeometry('ENG_FOLDER', 176, 112, 6)
    const corners = outline.filter((command) => command.type === 'M' || command.type === 'L')
    expect(corners).toContainEqual({ type: 'L', x: 0, y: 44 })
    expect(corners).toContainEqual({ type: 'L', x: 101, y: 44 })
    expect(points(outline).some((point) => point.y === 0)).toBe(true)
    expect(details).toEqual([
      { type: 'M', x: 0, y: 44 },
      { type: 'L', x: 101, y: 44 }
    ])
  })

  test('multiple documents draw a back page, with the front page’s edges over it as inner lines', () => {
    const { outline, details } = shapeWithTextGeometry('DOCUMENT_MULTIPLE', 176, 112, 6)
    const corners = outline.filter((command) => command.type === 'M' || command.type === 'L')
    // FigJam offsets the front page by 16 whatever the size.
    expect(corners).toContainEqual({ type: 'L', x: 160, y: 16 })
    expect(points(outline).some((point) => point.x === 0)).toBe(true)
    expect(details.slice(0, 2)).toEqual([
      { type: 'M', x: 160, y: 16 },
      { type: 'L', x: 16, y: 16 }
    ])
  })

  test('the fill is cut along the lines only of a shape with inner lines and no stroke drawing', () => {
    const stroke = (opacity: number, weight = 4): Stroke => ({
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity,
      visible: true,
      weight,
      align: 'CENTER'
    })
    const shape = (shapeWithTextType: 'ENG_DATABASE' | 'SQUARE', strokes: Stroke[]) => ({
      shapeWithTextType,
      width: 192,
      height: 128,
      strokes
    })
    expect(shapeWithTextCutsFill(shape('ENG_DATABASE', []))).toBe(true)
    expect(shapeWithTextCutsFill(shape('ENG_DATABASE', [stroke(0)]))).toBe(true)
    expect(shapeWithTextCutsFill(shape('ENG_DATABASE', [stroke(1, 0)]))).toBe(true)
    expect(shapeWithTextCutsFill(shape('ENG_DATABASE', [stroke(1)]))).toBe(false)
    expect(shapeWithTextCutsFill(shape('SQUARE', []))).toBe(false)
  })
})

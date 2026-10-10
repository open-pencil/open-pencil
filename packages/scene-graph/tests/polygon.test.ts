import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { compact } from 'es-toolkit'
import * as v from 'valibot'

import { polygonCorners, polygonOutline, type PolygonOutlineCommand } from '@open-pencil/scene-graph/polygon'

// Outlines Figma desktop gives as `fillGeometry` for polygons and stars, recorded on 2026-10-10.
const Oracle = v.object({
  cases: v.array(
    v.object({
      name: v.string(),
      type: v.picklist(['POLYGON', 'STAR']),
      pointCount: v.number(),
      width: v.number(),
      height: v.number(),
      cornerRadius: v.number(),
      cornerSmoothing: v.number(),
      starInnerRadius: v.nullable(v.number()),
      fillGeometry: v.array(v.string())
    })
  )
})

const oracle = v.parse(
  v.pipe(v.string(), v.parseJson(), Oracle),
  readFileSync(new URL('fixtures/figma-polygon-corners.json', import.meta.url), 'utf8')
)

type Point = [number, number]

/** Figma's commands as end points and controls, without the zero-length lines it leaves between arcs that meet. */
function figmaCommands(data: string): Array<{ type: string; points: Point[] }> {
  const commands: Array<{ type: string; points: Point[] }> = []
  let last: Point = [0, 0]
  for (const [, type, args] of data.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
    const numbers = compact(args.trim().split(/\s+/)).map(Number)
    const points: Point[] = []
    for (let index = 0; index < numbers.length; index += 2) points.push([numbers[index], numbers[index + 1]])
    const end = points.at(-1)
    if (type === 'L' && end && Math.hypot(end[0] - last[0], end[1] - last[1]) < 1e-3) continue
    if (end) last = end
    commands.push({ type, points })
  }
  return commands
}

function ourCommands(commands: PolygonOutlineCommand[]) {
  return commands.map((command) => {
    if (command.type === 'Z') return { type: 'Z', points: [] as Point[] }
    if (command.type === 'C')
      return {
        type: 'C',
        points: [
          [command.x1, command.y1],
          [command.x2, command.y2],
          [command.x, command.y]
        ] as Point[]
      }
    return { type: command.type, points: [[command.x, command.y]] as Point[] }
  })
}

// Where two clamped corners almost fill an edge, Figma stretches both along it to use the rest of
// the edge, leaving them slightly lopsided; ours stay circular with a short line between them.
const LOPSIDED = new Set(['wide star clamped'])

describe('polygon outlines', () => {
  for (const sample of oracle.cases) {
    const node = { ...sample, starInnerRadius: sample.starInnerRadius ?? 0 }
    const ours = ourCommands(polygonOutline(node))
    const figma = figmaCommands(sample.fillGeometry.join(' '))
    // Figma closes with a line back to the start, which Z already draws.
    if (figma.at(-2)?.type === 'L') figma.splice(-2, 1)

    if (LOPSIDED.has(sample.name)) {
      test(`${sample.name} stays within a third of a pixel of Figma`, () => {
        const theirs = figma.flatMap((command) => command.points)
        for (const [x, y] of ours.flatMap((command) => command.points)) {
          const nearest = Math.min(...theirs.map(([fx, fy]) => Math.hypot(x - fx, y - fy)))
          expect(nearest).toBeLessThan(0.35)
        }
      })
      continue
    }

    test(`${sample.name} matches Figma`, () => {
      expect(ours.map((command) => command.type)).toEqual(figma.map((command) => command.type))
      ours.forEach((command, index) =>
        command.points.forEach(([x, y], point) => {
          const [fx, fy] = figma[index].points[point]
          expect(Math.hypot(x - fx, y - fy)).toBeLessThan(0.01)
        })
      )
    })
  }

  test('a corner keeps its radius until it no longer fits along its edges', () => {
    const corners = (cornerRadius: number) =>
      polygonCorners({
        type: 'POLYGON',
        pointCount: 3,
        width: 160,
        height: 160,
        starInnerRadius: 0,
        cornerRadius,
        cornerSmoothing: 0
      }).map((corner) => corner.radius)
    expect(corners(24)).toEqual([24, 24, 24])
    corners(100).forEach((radius) => expect(radius).toBeCloseTo(40, 6))
  })
})

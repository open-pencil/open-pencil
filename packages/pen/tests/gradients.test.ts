import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenNode } from '@open-pencil/pen'
import type { Vector } from '@open-pencil/scene-graph'
import { colorToHex8 } from '@open-pencil/scene-graph/color'
import {
  DEFAULT_GRADIENT_TRANSFORM,
  gradientPoint,
  IDENTITY_GRADIENT_TRANSFORM,
  type GradientTransform
} from '@open-pencil/scene-graph/gradient'

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

function pen(child: PenNode): string {
  return JSON.stringify({ version: '2.8', children: [child] })
}

function read(json: string, name: string) {
  const graph = parsePenFile(json)
  // A page takes the name of the document's first child, so it can shadow the node under test.
  const nodes = [...graph.getAllNodes()].filter((node) => node.type !== 'CANVAS')
  return at(nodes.find((node) => node.name === name))
}

const FRAME: PenNode = { type: 'frame', id: 'f1', name: 'Fade', width: 100, height: 100 }

/** The gradient shape two of the triaged document's fills declare. */
const LINEAR_DOWN = {
  type: 'gradient',
  gradientType: 'linear',
  enabled: true,
  rotation: 180,
  size: { height: 1 },
  colors: [
    { color: '#123D2D66', position: 0 },
    { color: '#123D2DF2', position: 1 }
  ]
}

function stopsOf(json: string) {
  return read(json, 'Fade').fills[0]?.gradientStops?.map((stop) => ({
    hex: colorToHex8(stop.color),
    position: stop.position
  }))
}

/** Where a gradient axis point lands in the layer, which is what drawing the fill depends on. */
function axisPoint(transform: GradientTransform, point: Vector) {
  const landed = gradientPoint(transform, point)
  // Rounded, and with -0 folded into 0, so a corner reads as the corner it is.
  const round = (value: number) => Math.round(value * 1000) / 1000 || 0
  return { x: round(landed.x), y: round(landed.y) }
}

function axisOf(rotation: number) {
  const json = pen({ ...FRAME, fill: { ...LINEAR_DOWN, rotation } })
  const transform = at(read(json, 'Fade').fills[0]?.gradientTransform)
  return {
    start: axisPoint(transform, { x: 0, y: 0.5 }),
    end: axisPoint(transform, { x: 1, y: 0.5 })
  }
}

/** Compares a transform with what the engine names it, up to the float noise a matrix carries. */
function expectTransform(received: GradientTransform, expected: GradientTransform) {
  for (const key of ['m00', 'm01', 'm02', 'm10', 'm11', 'm12'] as const) {
    expect(received[key]).toBeCloseTo(expected[key], 6)
  }
}

describe('a linear gradient', () => {
  test('becomes a linear gradient fill that keeps its stops in order', () => {
    const json = pen({ ...FRAME, fill: LINEAR_DOWN })

    expect(read(json, 'Fade').fills[0]?.type).toBe('GRADIENT_LINEAR')
    expect(stopsOf(json)).toEqual([
      { hex: '#123D2D66', position: 0 },
      { hex: '#123D2DF2', position: 1 }
    ])
  })

  test('points down when its angle says so, the way the engine already names that transform', () => {
    const json = pen({ ...FRAME, fill: LINEAR_DOWN })

    expectTransform(at(read(json, 'Fade').fills[0]?.gradientTransform), DEFAULT_GRADIENT_TRANSFORM)
  })

  test('points right when its angle is 90, matching the identity transform', () => {
    const json = pen({ ...FRAME, fill: { ...LINEAR_DOWN, rotation: 90 } })

    expectTransform(at(read(json, 'Fade').fills[0]?.gradientTransform), IDENTITY_GRADIENT_TRANSFORM)
  })

  test('draws from the top edge to the bottom edge when its angle is 180', () => {
    expect(axisOf(180)).toEqual({ start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } })
  })

  test('draws left to right when its angle is 90', () => {
    expect(axisOf(90)).toEqual({ start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } })
  })

  test('draws bottom to top at 0, because the angle turns clockwise from pointing up', () => {
    expect(axisOf(0)).toEqual({ start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } })
  })

  test('draws corner to corner at 45, reaching both ends of the diagonal it spans', () => {
    const { start, end } = axisOf(45)

    expect(start).toEqual({ x: 0, y: 1 })
    expect(end).toEqual({ x: 1, y: 0 })
  })

  test('resolves a stop colour that references a declared variable', () => {
    const json = JSON.stringify({
      version: '2.8',
      variables: { '--fade': { type: 'color', value: '#abcdef' } },
      children: [
        {
          ...FRAME,
          fill: {
            ...LINEAR_DOWN,
            colors: [
              { color: '$--fade', position: 0 },
              { color: '#000000', position: 1 }
            ]
          }
        }
      ]
    })

    expect(at(stopsOf(json)[0]).hex).toBe('#ABCDEF')
  })
})

describe('a gradient kind whose geometry is not read', () => {
  test('is drawn centred, since only a linear angle is placed', () => {
    const json = pen({ ...FRAME, fill: { ...LINEAR_DOWN, gradientType: 'radial' } })
    const fill = read(json, 'Fade').fills[0]

    expect(fill?.type).toBe('GRADIENT_RADIAL')
    expect(fill?.gradientTransform).toEqual(DEFAULT_GRADIENT_TRANSFORM)
  })
})

describe('a gradient kind with no equivalent', () => {
  test('falls back to a solid fill, so the layer still paints', () => {
    const json = pen({ ...FRAME, fill: { ...LINEAR_DOWN, gradientType: 'conic' } })

    expect(read(json, 'Fade').fills[0]?.type).toBe('SOLID')
  })
})

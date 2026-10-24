import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import type { ConnectorControlPoint } from '@open-pencil/scene-graph'
import {
  connectorNetwork,
  dragCurve,
  dragElbowSegment,
  elbowControlPoints,
  elbowJoints,
  routeConnector,
  connectorSides,
  type ConnectorRouteEnd
} from '@open-pencil/scene-graph/connectors'

const pairSchema = v.tuple([v.number(), v.number()])
const boxSchema = v.tuple([v.number(), v.number(), v.number(), v.number()])
const endSchema = v.object({
  box: boxSchema,
  magnet: v.picklist(['AUTO', 'TOP', 'RIGHT', 'BOTTOM', 'LEFT']),
  outline: v.number()
})

/**
 * Routes FigJam derived on 2026-10-23 for connectors dragged into place from a 160 px shape at
 * the origin to another, each with its default caps and a weight of 4: one dragged at its middle
 * segment, one at its first segment, and one curve dragged at its midpoint. The other shape was
 * then moved and resized by script, which keeps the control points as they were.
 */
const oracle = v.parse(
  v.pipe(
    v.string(),
    v.parseJson(),
    v.array(
      v.object({
        name: v.string(),
        lineType: v.picklist(['ELBOWED', 'CURVED']),
        start: endSchema,
        end: endSchema,
        vertices: v.array(pairSchema),
        segments: v.array(v.tuple([v.number(), v.number(), pairSchema, pairSchema])),
        controls: v.array(v.object({ position: pairSchema, axis: pairSchema })),
        curve: v.array(pairSchema)
      })
    )
  ),
  readFileSync(new URL('figma-control-routes.json', import.meta.url), 'utf8')
)

function routeEnd(
  { box: [x, y, width, height], magnet, outline }: v.InferOutput<typeof endSchema>,
  cap: 'ROUND' | 'ARROW_LINES'
): ConnectorRouteEnd {
  return { box: { x, y, width, height }, point: { x: 0, y: 0 }, magnet, cap, outline }
}

function controlPoint(position: [number, number], axis: [number, number]): ConnectorControlPoint {
  return { position: { x: position[0], y: position[1] }, direction: axis[0] ? 'HORIZONTAL' : 'VERTICAL' }
}

const close = (actual: number, expected: number) => Math.abs(actual - expected) <= 0.01

describe('dragged connectors route as Figma does', () => {
  for (const c of oracle) {
    test(c.name, () => {
      const [first, second] = c.curve
      const pieces = routeConnector(
        c.lineType,
        routeEnd(c.start, 'ROUND'),
        routeEnd(c.end, 'ARROW_LINES'),
        4,
        {
          points: c.controls.map(({ position, axis }) => controlPoint(position, axis)),
          curve: first && second ? [{ x: first[0], y: first[1] }, { x: second[0], y: second[1] }] : null
        }
      )
      const network = connectorNetwork(pieces, { x: 0, y: 0 }, { start: 'ROUND', end: 'ARROW_LINES' })
      expect(network.vertices.map(({ x, y }) => [x, y])).toHaveLength(c.vertices.length)
      for (const [index, [x, y]] of c.vertices.entries()) {
        const vertex = network.vertices[index]
        expect({ index, ok: close(vertex.x, x) && close(vertex.y, y) }).toEqual({ index, ok: true })
      }
      for (const [index, [, , [t0x, t0y], [t1x, t1y]]] of c.segments.entries()) {
        const { tangentStart, tangentEnd } = network.segments[index]
        expect(
          close(tangentStart.x, t0x) &&
            close(tangentStart.y, t0y) &&
            close(tangentEnd.x, t1x) &&
            close(tangentEnd.y, t1y)
        ).toBe(true)
      }
    })
  }
})

/** Two 160 px shapes, the second below and to the right, as the drags were measured from. */
const start = routeEnd({ box: [0, 0, 160, 160], magnet: 'AUTO', outline: 2 }, 'ROUND')
const end = routeEnd({ box: [480, 320, 160, 160], magnet: 'AUTO', outline: 2 }, 'ARROW_LINES')
const auto = routeConnector('ELBOWED', start, end, 4)
const joints = elbowJoints(start, end, connectorSides(start, end))
const points = (controls: ConnectorControlPoint[]) =>
  controls.map(({ position, direction }) => [direction, position.x, position.y])

describe('dragging an elbow segment', () => {
  test('moves a middle segment alone', () => {
    expect(points(dragElbowSegment(auto, joints, 1, 352))).toEqual([['VERTICAL', 352, 240]])
  })

  test('turns a first segment out a stub from its layer', () => {
    const controls = dragElbowSegment(auto, joints, 0, 16)
    expect(points(controls)).toEqual([
      ['VERTICAL', 208, 80],
      ['HORIZONTAL', 244, 16],
      ['VERTICAL', 320, 240]
    ])
    // Recorded at each segment's midpoint once routed, as Figma stores them.
    const routed = routeConnector('ELBOWED', start, end, 4, { points: controls, curve: null })
    expect(points(elbowControlPoints(routed))).toEqual([
      ['VERTICAL', 208, 48],
      ['HORIZONTAL', 264, 16],
      ['VERTICAL', 320, 208]
    ])
  })

  test('turns a last segment out a stub from its layer', () => {
    const controls = dragElbowSegment(auto, joints, 2, 480)
    const routed = routeConnector('ELBOWED', start, end, 4, { points: controls, curve: null })
    expect(points(elbowControlPoints(routed))).toEqual([
      ['VERTICAL', 320, 280],
      ['HORIZONTAL', 376, 480],
      ['VERTICAL', 432, 440]
    ])
  })

  test('turns a lone segment out of both layers', () => {
    const level = routeEnd({ box: [480, 0, 160, 160], magnet: 'AUTO', outline: 2 }, 'ARROW_LINES')
    const straight = routeConnector('ELBOWED', start, level, 4)
    expect(straight).toHaveLength(1)
    const controls = dragElbowSegment(straight, elbowJoints(start, level, ['RIGHT', 'LEFT']), 0, 176)
    const routed = routeConnector('ELBOWED', start, level, 4, { points: controls, curve: null })
    expect(points(elbowControlPoints(routed))).toEqual([
      ['VERTICAL', 208, 128],
      ['HORIZONTAL', 320, 176],
      ['VERTICAL', 432, 128]
    ])
  })
})

test('dragging a curve moves both control points by 4/3 of the drag', () => {
  const [curve] = routeConnector('CURVED', start, end, 4)
  const handles = dragCurve(
    [
      { x: curve.from.x + curve.handleFrom.x, y: curve.from.y + curve.handleFrom.y },
      { x: curve.to.x + curve.handleTo.x, y: curve.to.y + curve.handleTo.y }
    ],
    { x: 80, y: -80 }
  )
  expect(handles.map(({ x, y }) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])).toEqual([
    [459.76, -26.67],
    [393.58, 293.33]
  ])
})

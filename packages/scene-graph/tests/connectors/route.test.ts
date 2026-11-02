import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import {
  connectorNetwork,
  placeConnectorLabel,
  routeConnector,
  type ConnectorRouteEnd
} from '@open-pencil/scene-graph/connectors'

const MAGNETS = [
  'NONE',
  'AUTO',
  'AUTO_HORIZONTAL',
  'TOP',
  'RIGHT',
  'BOTTOM',
  'LEFT',
  'CENTER'
] as const
const CAPS = [
  'NONE',
  'ROUND',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
] as const
const pairSchema = v.tuple([v.number(), v.number()])
const endSchema = v.object({
  magnet: v.picklist(MAGNETS),
  box: v.optional(v.tuple([v.number(), v.number(), v.number(), v.number()])),
  outline: v.optional(v.number()),
  point: v.optional(pairSchema)
})

/**
 * Routes FigJam derived for connectors from a FigJam square at the origin, recorded on 2026-10-15:
 * squares around it in every direction and size, every magnet pair, caps, stroke weights, the
 * squares' own strokes (`outline`, half the stroke), free ends, and labels. Coordinates are
 * relative to the start square.
 */
const oracleSchema = v.array(
  v.object({
    name: v.string(),
    lineType: v.picklist(['ELBOWED', 'STRAIGHT', 'CURVED']),
    weight: v.number(),
    startCap: v.picklist(CAPS),
    endCap: v.picklist(CAPS),
    start: endSchema,
    end: endSchema,
    vertices: v.array(pairSchema),
    segments: v.optional(v.array(v.tuple([v.number(), v.number(), pairSchema, pairSchema]))),
    label: v.optional(
      v.object({ text: pairSchema, plate: v.tuple([v.number(), v.number(), v.number(), v.number()]) })
    )
  })
)

const oracle = v.parse(
  v.pipe(v.string(), v.parseJson(), oracleSchema),
  readFileSync(new URL('figma-routes.json', import.meta.url), 'utf8')
)

type Case = (typeof oracle)[number]

function routeEnd(end: Case['start'], cap: Case['startCap']): ConnectorRouteEnd {
  const [x, y, width, height] = end.box ?? [0, 0, 0, 0]
  const [px, py] = end.point ?? [0, 0]
  return {
    box: end.box ? { x, y, width, height } : null,
    point: { x: px, y: py },
    magnet: end.magnet,
    cap,
    outline: end.outline ?? 0
  }
}

function route(c: Case) {
  const pieces = routeConnector(
    c.lineType,
    routeEnd(c.start, c.startCap),
    routeEnd(c.end, c.endCap),
    c.weight
  )
  if (!c.label) return { pieces, plate: null }
  const [width, height] = c.label.text
  const placed = placeConnectorLabel(pieces, { width: width + 17, height: height + 17 })
  return { pieces: placed?.pieces ?? pieces, plate: placed?.plate ?? null }
}

/** The fixture keeps routes to a hundredth. */
const TOLERANCE = 0.01
/** Figma's gap for an equilateral arrow drifts by a few hundredths between connectors. */
const EQUILATERAL_TOLERANCE = 0.05

function close(actual: number, expected: number, tolerance = TOLERANCE) {
  return Math.abs(actual - expected) <= tolerance
}

describe('connector routes match Figma', () => {
  for (const c of oracle) {
    test(c.name, () => {
      const { pieces, plate } = route(c)
      const network = connectorNetwork(pieces, { x: 0, y: 0 }, { start: c.startCap, end: c.endCap })
      const tolerance = [c.startCap, c.endCap].includes('ARROW_EQUILATERAL')
        ? EQUILATERAL_TOLERANCE
        : TOLERANCE
      const vertices = network.vertices.map(({ x, y }) => [x, y])
      expect(vertices.length).toBe(c.vertices.length)
      for (const [index, [x, y]] of c.vertices.entries()) {
        const [ax, ay] = vertices[index]
        expect({ index, ok: close(ax, x, tolerance) && close(ay, y, tolerance) }).toEqual({
          index,
          ok: true
        })
      }
      const segments =
        c.segments ??
        c.vertices
          .slice(1)
          .map((_, index): [number, number, [number, number], [number, number]] => [
            index,
            index + 1,
            [0, 0],
            [0, 0]
          ])
      expect(network.segments.map(({ start, end }) => [start, end])).toEqual(
        segments.map(([start, end]) => [start, end])
      )
      for (const [index, [, , [t0x, t0y], [t1x, t1y]]] of segments.entries()) {
        const { tangentStart, tangentEnd } = network.segments[index]
        expect(
          close(tangentStart.x, t0x) &&
            close(tangentStart.y, t0y) &&
            close(tangentEnd.x, t1x) &&
            close(tangentEnd.y, t1y)
        ).toBe(true)
      }
      if (c.label) {
        if (!plate) throw new Error('A labelled case places no plate')
        const [x, y, width, height] = c.label.plate
        expect(
          [plate.x, plate.y, plate.width, plate.height].map((n) => Math.round(n * 100) / 100)
        ).toEqual([x, y, width, height])
      }
    })
  }
})

test('a label on a line with no length keeps the line its one point', () => {
  const point = { x: 50, y: 0 }
  const pieces = [{ from: point, to: point, handleFrom: { x: 0, y: 0 }, handleTo: { x: 0, y: 0 } }]
  const placed = placeConnectorLabel(pieces, { width: 40, height: 20 })
  expect(placed?.pieces).toEqual(pieces)
  expect(placed?.plate).toEqual({ x: 30, y: -10, width: 40, height: 20 })
})

/**
 * Ends FigJam pinned to a point of a 400 × 320 section at (480, -100), dropped there from a
 * connector leaving a 160 px shape at the origin, a 96 px one below the section, and one to its
 * right; measured on 2026-10-19 from the connectors' boxes.
 */
describe('an end pinned to a point of a section', () => {
  const pinned = (x: number, y: number, magnet: 'ABSOLUTE' | 'NONE'): ConnectorRouteEnd => ({
    box: null,
    point: { x, y },
    magnet,
    cap: 'ARROW_LINES',
    outline: 0
  })
  const from = (x: number, y: number, size: number): ConnectorRouteEnd => ({
    box: { x, y, width: size, height: size },
    point: { x: 0, y: 0 },
    magnet: 'AUTO',
    cap: 'ROUND',
    outline: 0
  })
  const last = (start: ConnectorRouteEnd, end: ConnectorRouteEnd) =>
    routeConnector('ELBOWED', start, end, 4).at(-1)?.to

  test('is reached along the longer axis and stops short by its cap', () => {
    expect(last(from(0, 0, 160), pinned(520, 158, 'ABSOLUTE'))).toEqual({ x: 513.5, y: 158 })
    expect(last(from(632, 364, 96), pinned(560, 158, 'ABSOLUTE'))).toEqual({ x: 560, y: 164.5 })
    expect(last(from(1040, 12, 96), pinned(560, 158, 'ABSOLUTE'))).toEqual({ x: 566.5, y: 158 })
  })

  test('set by a script, is reached exactly', () => {
    expect(last(from(0, 0, 160), pinned(520, 158, 'NONE'))).toEqual({ x: 520, y: 158 })
  })
})

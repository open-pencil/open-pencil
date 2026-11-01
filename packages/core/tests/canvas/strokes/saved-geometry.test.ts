import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import type { SceneGraph, Stroke } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'
import { renderRow } from '#core-tests/helpers/figma-rows'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const RED = 0
const BLUE = 2
const ALPHA = 3
const SIZE = 160
const WEIGHT = 8

type Point = readonly [x: number, y: number]

function box(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ]
}

function contoursBlob(contours: Point[][]): Uint8Array {
  const commands = contours.flatMap((points) => [
    ...points.map(([x, y], index) => [index === 0 ? 1 : 2, x, y]),
    [0, 0, 0]
  ])
  const blob = new Uint8Array(commands.reduce((length, [command]) => length + (command ? 9 : 1), 0))
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const [command, x, y] of commands) {
    blob[offset++] = command
    if (command) {
      view.setFloat32(offset, x, true)
      view.setFloat32(offset + 4, y, true)
      offset += 8
    }
  }
  return blob
}

function vectorWithSavedBand(align: Stroke['align']) {
  return (graph: SceneGraph, hostId: string) => {
    graph.createNode('VECTOR', hostId, {
      x: 120,
      y: 70,
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          weight: WEIGHT,
          align
        }
      ],
      strokeWeight: WEIGHT,
      strokeAlign: align,
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(0, 0, SIZE, SIZE)]) }
      ],
      strokeGeometry: [
        {
          windingRule: 'EVENODD',
          commandsBlob: contoursBlob([
            box(-WEIGHT, -WEIGHT, SIZE + WEIGHT, SIZE + WEIGHT),
            box(WEIGHT, WEIGHT, SIZE - WEIGHT, SIZE - WEIGHT)
          ])
        }
      ]
    })
  }
}

function leftEdgeRow(align: Stroke['align'], channel: number): number[] {
  return renderRow(ck, renderer, vectorWithSavedBand(align), 150, 104, 134, channel)
}

describe('a vector’s saved stroke geometry, a band twice the weight around the outline', () => {
  test('keeps an outside stroke off the fill', () => {
    expect(leftEdgeRow('OUTSIDE', BLUE)).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0
    ])
    expect(leftEdgeRow('OUTSIDE', RED)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255
    ])
  })

  test('keeps an inside stroke within the fill', () => {
    expect(leftEdgeRow('INSIDE', ALPHA)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255
    ])
    expect(leftEdgeRow('INSIDE', BLUE)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  })
})

const HALF = WEIGHT / 2

function openPathWithCentredSavedStroke(graph: SceneGraph, hostId: string) {
  graph.createNode('VECTOR', hostId, {
    x: 120,
    y: 70,
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        weight: WEIGHT,
        align: 'OUTSIDE'
      }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'OUTSIDE',
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: SIZE, y: 0 },
        { x: SIZE, y: SIZE }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    },
    fillGeometry: [
      {
        windingRule: 'NONZERO',
        commandsBlob: contoursBlob([
          [
            [0, 0],
            [SIZE, 0],
            [SIZE, SIZE]
          ]
        ])
      }
    ],
    strokeGeometry: [
      {
        windingRule: 'NONZERO',
        commandsBlob: contoursBlob([
          box(-HALF, -HALF, SIZE + HALF, HALF),
          box(SIZE - HALF, -HALF, SIZE + HALF, SIZE + HALF)
        ])
      }
    ]
  })
}

describe('an open vector’s saved stroke geometry', () => {
  test('draws whole, as Figma strokes an open path on its centre line', () => {
    expect(renderRow(ck, renderer, openPathWithCentredSavedStroke, 72, 140, 260, BLUE)).toEqual(
      Array.from({ length: 61 }, () => 255)
    )
  })
})

function twoRegionsWithInsideStroke(graph: SceneGraph, hostId: string) {
  graph.createNode('VECTOR', hostId, {
    x: 120,
    y: 70,
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        weight: WEIGHT,
        align: 'INSIDE'
      }
    ],
    strokeWeight: WEIGHT,
    strokeAlign: 'INSIDE',
    fillGeometry: [
      { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(0, 0, 60, SIZE)]) },
      { windingRule: 'NONZERO', commandsBlob: contoursBlob([box(100, 0, SIZE, SIZE)]) }
    ],
    strokeGeometry: [
      {
        windingRule: 'EVENODD',
        commandsBlob: contoursBlob([
          box(-WEIGHT, -WEIGHT, 60 + WEIGHT, SIZE + WEIGHT),
          box(WEIGHT, WEIGHT, 60 - WEIGHT, SIZE - WEIGHT),
          box(100 - WEIGHT, -WEIGHT, SIZE + WEIGHT, SIZE + WEIGHT),
          box(100 + WEIGHT, WEIGHT, SIZE - WEIGHT, SIZE - WEIGHT)
        ])
      }
    ]
  })
}

const INSIDE_BANDS = [
  [0, WEIGHT],
  [60 - WEIGHT, 60],
  [100, 100 + WEIGHT],
  [SIZE - WEIGHT, SIZE]
]

describe('a vector with several fill regions', () => {
  test('keeps an inside stroke within each of them', () => {
    const expected = Array.from({ length: 91 }, (_, index) => {
      const x = index * 2 - 10
      return INSIDE_BANDS.some(([start, end]) => x >= start && x < end) ? 255 : 0
    })
    expect(renderRow(ck, renderer, twoRegionsWithInsideStroke, 150, 110, 290, BLUE)).toEqual(
      expected
    )
  })
})

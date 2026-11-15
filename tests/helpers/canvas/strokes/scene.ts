import type {
  Effect,
  GradientTransform,
  SceneGraph,
  SceneNode,
  Stroke,
  VectorNetwork
} from '@open-pencil/scene-graph'
import {
  DEFAULT_GRADIENT_TRANSFORM,
  IDENTITY_GRADIENT_TRANSFORM
} from '@open-pencil/scene-graph/gradient'

import { solid } from '../paints'

const ALIGNS = ['INSIDE', 'CENTER', 'OUTSIDE'] as const
const CORNERS = [
  { name: 'sharp', cornerRadius: 0, dashPattern: undefined },
  { name: 'rounded', cornerRadius: 24, dashPattern: undefined },
  { name: 'dashed', cornerRadius: 0, dashPattern: [20, 10] },
  { name: 'rounded dashed', cornerRadius: 24, dashPattern: [20, 10] }
]

/**
 * Translucent frames with sides of their own weights, one row per alignment, then a row with
 * every side at one weight: sharp, rounded, dashed, and rounded and dashed.
 */
export function createSideStrokesScene(graph: SceneGraph, pageId: string): void {
  for (const [row, align] of [...ALIGNS, 'CENTER' as const].entries()) {
    const even = row === ALIGNS.length
    for (const [column, corner] of CORNERS.entries()) {
      graph.createNode('FRAME', pageId, {
        name: `${even ? 'even' : align} ${corner.name}`,
        x: 60 + column * 200,
        y: 60 + row * 170,
        width: 140,
        height: 120,
        cornerRadius: corner.cornerRadius,
        fills: [],
        clipsContent: false,
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0.23, g: 0.4, b: 0.95, a: 1 },
            opacity: 0.5,
            visible: true,
            weight: 8,
            align,
            dashPattern: corner.dashPattern
          }
        ],
        strokeWeight: 8,
        strokeAlign: align,
        independentStrokeWeights: !even,
        borderTopWeight: 8,
        borderRightWeight: 0,
        borderBottomWeight: 16,
        borderLeftWeight: 4
      })
    }
  }
}

/** A dashed rectangle, section, and component set side by side, each rounded and each sharp. */
export function createDashedContainersScene(graph: SceneGraph, pageId: string): void {
  const types = ['RECTANGLE', 'SECTION', 'COMPONENT_SET'] as const
  for (const [column, type] of types.entries()) {
    for (const [row, cornerRadius] of [0, 24].entries()) {
      graph.createNode(type, pageId, {
        name: `${type.toLowerCase()} ${cornerRadius ? 'rounded' : 'sharp'}`,
        x: 60 + column * 270,
        y: 80 + row * 300,
        width: 200,
        height: 200,
        cornerRadius,
        fills: [],
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0.6, g: 0.2, b: 0.9, a: 1 },
            opacity: 1,
            visible: true,
            weight: 4,
            align: 'CENTER',
            dashPattern: [20, 10]
          }
        ],
        strokeWeight: 4,
        strokeAlign: 'CENTER'
      })
    }
  }
}

/**
 * Dashed rectangles with round and square dash ends, inside and outside round ends, round and
 * bevel joins, and smoothed corners with and without round ends.
 */
export function createDashEndsScene(graph: SceneGraph, pageId: string): void {
  const cases: Array<[string, Partial<SceneNode>]> = [
    ['round ends', { strokeCap: 'ROUND' }],
    ['square ends', { strokeCap: 'SQUARE' }],
    ['inside round ends', { strokeCap: 'ROUND', strokeAlign: 'INSIDE' }],
    ['outside round ends', { strokeCap: 'ROUND', strokeAlign: 'OUTSIDE' }],
    ['round join', { strokeJoin: 'ROUND' }],
    ['bevel join', { strokeJoin: 'BEVEL' }],
    ['smoothed', { cornerRadius: 25, cornerSmoothing: 0.6 }],
    ['smoothed round ends', { cornerRadius: 25, cornerSmoothing: 0.6, strokeCap: 'ROUND' }]
  ]
  for (const [index, [name, props]] of cases.entries()) {
    const align = props.strokeAlign ?? 'CENTER'
    graph.createNode('RECTANGLE', pageId, {
      name,
      x: 60 + (index % 4) * 200,
      y: 80 + Math.floor(index / 4) * 260,
      width: 150,
      height: 150,
      fills: [],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0.6, g: 0.2, b: 0.9, a: 1 },
          opacity: 1,
          visible: true,
          weight: 8,
          align,
          dashPattern: [20, 10]
        }
      ],
      strokeWeight: 8,
      ...props,
      strokeAlign: align
    })
  }
}

const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }

function gradientStroke(gradientTransform: GradientTransform): Stroke {
  return {
    type: 'GRADIENT_LINEAR',
    color: RED,
    opacity: 1,
    visible: true,
    weight: 6,
    align: 'CENTER',
    gradientStops: [
      { position: 0, color: RED },
      { position: 1, color: BLUE }
    ],
    gradientTransform
  }
}

/**
 * A solid rectangle as a landmark, and three straight lines with a red to blue gradient stroke: a
 * horizontal one with no height, a vertical one with no width and Figma's default top to bottom
 * transform, and a rotated one. Each runs red at its start to blue at its end.
 */
export function createGradientLinesScene(graph: SceneGraph, pageId: string): void {
  graph.createNode('RECTANGLE', pageId, {
    name: 'landmark',
    x: 60,
    y: 60,
    width: 120,
    height: 80,
    fills: [solid(0.2, 0.7, 0.4)]
  })
  const lines: Array<[string, Partial<SceneNode>, GradientTransform]> = [
    ['horizontal', { x: 60, y: 200, width: 300, height: 0 }, IDENTITY_GRADIENT_TRANSFORM],
    ['vertical', { x: 460, y: 60, width: 0, height: 200 }, DEFAULT_GRADIENT_TRANSFORM],
    ['rotated', { x: 60, y: 280, width: 300, height: 0, rotation: 30 }, IDENTITY_GRADIENT_TRANSFORM]
  ]
  for (const [name, placement, transform] of lines) {
    graph.createNode('LINE', pageId, {
      name: `${name} line`,
      fills: [],
      strokes: [gradientStroke(transform)],
      strokeWeight: 6,
      ...placement
    })
  }
}

/**
 * Translucent squares drawn from their paths with a centred, an inside, and an outside stroke, as
 * a vector without a saved stroke outline draws, such as one drawn or resized on the canvas.
 */
export function createVectorStrokeAlignScene(graph: SceneGraph, pageId: string): void {
  const side = 80
  const corner = { x: 0, y: 0 }
  for (const [column, align] of (['CENTER', 'INSIDE', 'OUTSIDE'] as const).entries()) {
    graph.createNode('VECTOR', pageId, {
      name: align,
      x: 60 + column * 160,
      y: 60,
      width: side,
      height: side,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: side, y: 0 },
          { x: side, y: side },
          { x: 0, y: side }
        ],
        segments: [0, 1, 2, 3].map((start) => ({
          start,
          end: (start + 1) % 4,
          tangentStart: corner,
          tangentEnd: corner
        })),
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
      },
      fills: [solid(0.86, 0.91, 0.98)],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0.1, g: 0.1, b: 0.2, a: 1 },
          weight: 12,
          opacity: 0.6,
          visible: true,
          align,
          cap: 'NONE',
          join: 'MITER',
          dashPattern: []
        }
      ]
    })
  }
}

const REGION_SIDE = 80

function squareSegments(corners: number[]): VectorNetwork['segments'] {
  const corner = { x: 0, y: 0 }
  return corners.map((start, index) => ({
    start,
    end: corners[(index + 1) % corners.length],
    tangentStart: corner,
    tangentEnd: corner
  }))
}

/** Three regions on the same square's four segments. */
function stackedRegions(): VectorNetwork {
  const s = REGION_SIDE
  const loop = [0, 1, 2, 3]
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: s, y: 0 },
      { x: s, y: s },
      { x: 0, y: s }
    ],
    segments: squareSegments(loop),
    regions: [0, 1, 2].map(() => ({ windingRule: 'NONZERO' as const, loops: [loop] }))
  }
}

/** Three 60px squares, 20px apart, each its own region. */
function overlappingSquares(): VectorNetwork {
  const vertices = [0, 20, 40].flatMap((offset) => [
    { x: offset, y: offset },
    { x: offset + 60, y: offset },
    { x: offset + 60, y: offset + 60 },
    { x: offset, y: offset + 60 }
  ])
  const segments = [0, 4, 8].flatMap((first) =>
    squareSegments([first, first + 1, first + 2, first + 3])
  )
  return {
    vertices,
    segments,
    regions: [0, 4, 8].map((first) => ({
      windingRule: 'NONZERO' as const,
      loops: [[first, first + 1, first + 2, first + 3]]
    }))
  }
}

/** A square cut by its diagonal into two regions that share it. */
function splitSquare(): VectorNetwork {
  const s = REGION_SIDE
  const corner = { x: 0, y: 0 }
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: s, y: 0 },
      { x: s, y: s },
      { x: 0, y: s }
    ],
    segments: [
      ...squareSegments([0, 1, 2, 3]),
      { start: 0, end: 2, tangentStart: corner, tangentEnd: corner }
    ],
    regions: [
      { windingRule: 'NONZERO', loops: [[0, 1, 4]] },
      { windingRule: 'NONZERO', loops: [[4, 2, 3]] }
    ]
  }
}

/** Two squares overlapping by half, wound opposite ways, each its own region. */
function oppositeSquares(): VectorNetwork {
  const vertices = [0, 30].flatMap((offset) => [
    { x: offset, y: offset },
    { x: offset + 50, y: offset },
    { x: offset + 50, y: offset + 50 },
    { x: offset, y: offset + 50 }
  ])
  return {
    vertices,
    segments: [...squareSegments([0, 1, 2, 3]), ...squareSegments([7, 6, 5, 4])],
    regions: [
      { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
      { windingRule: 'NONZERO', loops: [[4, 5, 6, 7]] }
    ]
  }
}

function regionStroke(align: Stroke['align']): Stroke {
  return {
    type: 'SOLID',
    color: { r: 0.1, g: 0.1, b: 0.2, a: 1 },
    weight: 8,
    opacity: 0.5,
    visible: true,
    align,
    cap: 'NONE',
    join: 'MITER',
    dashPattern: []
  }
}

function regionShadow(): Effect {
  return {
    type: 'DROP_SHADOW',
    radius: 0,
    spread: 0,
    offset: { x: 10, y: 10 },
    color: { r: 0, g: 0, b: 0, a: 0.5 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

/**
 * Vectors made of several fill regions, drawn as one shape as Figma draws them: three regions on
 * one square with an inside stroke and a drop shadow, three overlapping squares with a centred
 * stroke, a square split by its diagonal with an outside and an inside stroke, and two squares
 * wound opposite ways with a drop shadow; the pixels are checked in
 * packages/core/tests/canvas/strokes/regions.test.ts and shadows/shape.test.ts.
 */
export function createVectorRegionsScene(graph: SceneGraph, pageId: string): void {
  const layers: {
    name: string
    network: VectorNetwork
    stroke?: Stroke['align']
    shadow?: boolean
  }[] = [
    { name: 'Stacked regions', network: stackedRegions(), stroke: 'INSIDE', shadow: true },
    { name: 'Overlapping squares', network: overlappingSquares(), stroke: 'CENTER' },
    { name: 'Split square outside', network: splitSquare(), stroke: 'OUTSIDE' },
    { name: 'Split square inside', network: splitSquare(), stroke: 'INSIDE' },
    { name: 'Opposite squares', network: oppositeSquares(), shadow: true }
  ]
  for (const [index, { name, network, stroke, shadow }] of layers.entries()) {
    graph.createNode('VECTOR', pageId, {
      name,
      x: 60 + (index % 3) * 160,
      y: 60 + Math.floor(index / 3) * 160,
      width: REGION_SIDE,
      height: REGION_SIDE,
      vectorNetwork: network,
      fills: [solid(0.96, 0.35, 0.35)],
      strokes: stroke ? [regionStroke(stroke)] : [],
      effects: shadow ? [regionShadow()] : []
    })
  }
}

import type {
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
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

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
  for (const [column, align] of (['CENTER', 'INSIDE', 'OUTSIDE'] as const).entries()) {
    graph.createNode('VECTOR', pageId, {
      name: align,
      x: 60 + column * 160,
      y: 60,
      width: side,
      height: side,
      vectorNetwork: squareNetwork(side),
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

const ZERO = { x: 0, y: 0 }

/** A closed square from the origin to `side`, the path a vector saved before layout resized it. */
function squareNetwork(side: number): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: side, y: 0 },
      { x: side, y: side },
      { x: 0, y: side }
    ],
    segments: [0, 1, 2, 3].map((start) => ({
      start,
      end: (start + 1) % 4,
      tangentStart: ZERO,
      tangentEnd: ZERO
    })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

/** A closed rectangle from the origin, as saved fill geometry. The last byte closes the path. */
function rectBlob(width: number, height: number): Uint8Array {
  const corners: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ]
  const blob = new Uint8Array(corners.length * 9 + 1)
  const view = new DataView(blob.buffer)
  corners.forEach(([x, y], index) => {
    blob[index * 9] = index === 0 ? 1 : 2
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  })
  return blob
}

/** A non-empty outline saved for the previous box. Layout drops it when the box changes. */
const SAVED_OUTLINE = {
  windingRule: 'EVENODD' as const,
  commandsBlob: new Uint8Array([1, 2, 3, 4])
}

function alignedStroke(align: Stroke['align'], weight: number): Stroke {
  return {
    type: 'SOLID',
    color: { r: 0.1, g: 0.1, b: 0.2, a: 1 },
    weight,
    opacity: 1,
    visible: true,
    align,
    cap: 'NONE',
    join: 'MITER',
    dashPattern: []
  }
}

/** Writes the size layout kept, the same way a layout pass publishes a resized box. */
function resizeInLayout(graph: SceneGraph, id: string, width: number, height: number) {
  graph.withLayoutMutations(() => {
    graph.updateNode(id, { width, height })
  })
}

/**
 * A frame and an instance whose inside stroke was saved for a smaller box, then a vector path
 * at each alignment, each grown by layout. The stroke follows the new box: the saved outline is
 * dropped, and the vector path scales with the box.
 */
export function createResizedStrokeScene(graph: SceneGraph, pageId: string): void {
  const fill = solid(0.92, 0.25, 0.22)
  const weight = 12
  const stroke = alignedStroke('INSIDE', weight)
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Resized frame',
    x: 60,
    y: 60,
    width: 80,
    height: 48,
    fills: [fill],
    strokes: [stroke],
    strokeAlign: 'INSIDE',
    strokeWeight: weight,
    strokeGeometry: [SAVED_OUTLINE]
  })
  resizeInLayout(graph, frame.id, 200, 110)

  const badge = graph.createNode('COMPONENT', pageId, {
    name: 'Badge',
    x: 4000,
    y: 4000,
    width: 80,
    height: 48,
    fills: [fill],
    strokes: [stroke],
    strokeAlign: 'INSIDE',
    strokeWeight: weight,
    strokeGeometry: [SAVED_OUTLINE]
  })
  const instance = graph.createInstance(badge.id, pageId, { x: 340, y: 60 })
  if (!instance) throw new Error('Instance was not created')
  graph.updateNode(instance.id, { strokeGeometry: [SAVED_OUTLINE] })
  resizeInLayout(graph, instance.id, 200, 110)
  // The editor syncs an instance back to its component unless the new size is its own.
  recordInstanceOverride(graph, instance.id, ['width', 'height'])

  const vectorFill = solid(0.86, 0.91, 0.98)
  for (const [column, align] of (['INSIDE', 'CENTER', 'OUTSIDE'] as const).entries()) {
    const vector = graph.createNode('VECTOR', pageId, {
      name: align,
      x: 60 + column * 240,
      y: 230,
      width: 80,
      height: 80,
      vectorNetwork: squareNetwork(80),
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectBlob(80, 80) }],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectBlob(80, 80) }],
      fills: [vectorFill],
      strokes: [alignedStroke(align, 16)],
      strokeAlign: align,
      strokeWeight: 16
    })
    resizeInLayout(graph, vector.id, 160, 110)
  }
}

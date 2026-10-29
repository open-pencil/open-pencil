import type { GradientTransform, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import {
  DEFAULT_GRADIENT_TRANSFORM,
  IDENTITY_GRADIENT_TRANSFORM
} from '@open-pencil/scene-graph/gradient'

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
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.7, b: 0.4, a: 1 }, opacity: 1, visible: true }]
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

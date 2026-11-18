import { compact } from 'es-toolkit/array'

import type { SceneNode } from '@open-pencil/scene-graph'
import { nodeCornerRadii } from '@open-pencil/scene-graph/corners'
import {
  GeometryCommand,
  polygonVertices,
  readGeometryBlob
} from '@open-pencil/scene-graph/geometry'
import {
  arcOutline,
  outlineSVGPath,
  svgPathSink,
  sweepsWholeEllipse,
  traceSmoothRect,
  type ArcSweep,
  type SmoothCornerSink
} from '@open-pencil/scene-graph/paths'
import { polygonOutline } from '@open-pencil/scene-graph/polygon'
import { shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'
import { vectorNetworkToSVGPaths } from '@open-pencil/scene-graph/vector-network'

export function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function coordinate(value: number, decimals: number | null): number {
  return decimals === null ? value : round(value, decimals)
}

export function geometryBlobToSVGPath(blob: Uint8Array, decimals: number | null = 2): string {
  const parts: string[] = []
  const letters: Record<GeometryCommand, string> = {
    [GeometryCommand.CLOSE]: 'Z',
    [GeometryCommand.MOVE]: 'M',
    [GeometryCommand.LINE]: 'L',
    [GeometryCommand.QUAD]: 'Q',
    [GeometryCommand.CUBIC]: 'C'
  }
  readGeometryBlob(blob, (command, coords) => {
    const values = coords.map((value) => coordinate(value, decimals))
    parts.push(`${letters[command]}${values.join(' ')}`)
  })
  return parts.join('')
}

/** The outline of a polygon or star whose corners are rounded, as path data. */
export function roundedPolygonPath(node: SceneNode): string {
  return outlineSVGPath(polygonOutline(node), (value) => round(value))
}

export function makePolygonPoints(node: SceneNode): string {
  return polygonVertices(node)
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(' ')
}

type RectOutlineNode = Pick<
  SceneNode,
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'independentCorners'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomRightRadius'
  | 'bottomLeftRadius'
>

export function roundedRectPath(node: RectOutlineNode): string {
  const w = node.width
  const h = node.height
  const [tl, tr, br, bl] = nodeCornerRadii(node)

  return compact([
    `M${round(tl)} 0`,
    `L${round(w - tr)} 0`,
    tr > 0 ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(w)} ${round(tr)}` : '',
    `L${round(w)} ${round(h - br)}`,
    br > 0 ? `A${round(br)} ${round(br)} 0 0 1 ${round(w - br)} ${round(h)}` : '',
    `L${round(bl)} ${round(h)}`,
    bl > 0 ? `A${round(bl)} ${round(bl)} 0 0 1 0 ${round(h - bl)}` : '',
    `L0 ${round(tl)}`,
    tl > 0 ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(tl)} 0` : '',
    'Z'
  ]).join('')
}

/** An ellipse or arc as path data, drawn from the same outline as the canvas draws it. */
export function arcPath(node: Pick<SceneNode, 'width' | 'height' | 'arcData'>): string {
  const { cx, cy, contours } = arcOutline(node)
  const at = (step: ArcSweep, angle: number) =>
    `${round(cx + step.rx * Math.cos(angle))} ${round(cy + step.ry * Math.sin(angle))}`
  const parts: string[] = []
  for (const contour of contours) {
    for (const [index, step] of contour.entries()) {
      if (step.type === 'centre') {
        parts.push(`L${round(cx)} ${round(cy)}`)
        continue
      }
      const radii = `${round(step.rx)} ${round(step.ry)}`
      const turn = step.sweep > 0 ? 1 : 0
      if (sweepsWholeEllipse(step)) {
        // Two half turns: one SVG arc cannot end where it starts.
        const left = `${round(cx - step.rx)} ${round(cy)}`
        const right = `${round(cx + step.rx)} ${round(cy)}`
        parts.push(`M${left}A${radii} 0 1 ${turn} ${right}A${radii} 0 1 ${turn} ${left}`)
        continue
      }
      const large = Math.abs(step.sweep) > Math.PI ? 1 : 0
      parts.push(`${index === 0 ? 'M' : 'L'}${at(step, step.start)}`)
      parts.push(`A${radii} 0 ${large} ${turn} ${at(step, step.start + step.sweep)}`)
    }
    parts.push('Z')
  }
  return parts.join('')
}

/** A rectangle with smoothed corners as path data, traced as the canvas draws it. */
function smoothRectPath(node: RectOutlineNode & Pick<SceneNode, 'cornerSmoothing'>): string {
  const parts: string[] = []
  const point = (x: number, y: number) => `${round(x)} ${round(y)}`
  const sink: SmoothCornerSink = {
    ...svgPathSink(parts),
    arcToRotated: (rx, ry, rotation, useSmallArc, isCCW, x, y) =>
      parts.push(
        `A${round(rx)} ${round(ry)} ${rotation} ${useSmallArc ? 0 : 1} ${isCCW ? 0 : 1} ${point(x, y)}`
      )
  }
  const box = { left: 0, top: 0, right: node.width, bottom: node.height }
  return traceSmoothRect(sink, node, box) ? parts.join('') : roundedRectPath(node)
}

/**
 * A box layer's outline as path data: its rectangle with its corner radii, smoothed as the canvas
 * draws them. Frames, rectangles, and other box layers share it for fills, strokes, and clips.
 */
export function boxOutlinePath(node: RectOutlineNode & Pick<SceneNode, 'cornerSmoothing'>): string {
  return node.cornerSmoothing > 0 ? smoothRectPath(node) : roundedRectPath(node)
}

/** What a layer's outline is drawn from. */
export type OutlineNode = RectOutlineNode &
  Pick<
    SceneNode,
    'type' | 'arcData' | 'pointCount' | 'starInnerRadius' | 'cornerSmoothing' | 'vectorNetwork'
  >

/**
 * A shape layer's outline in its own box as path data: a rectangle with its corners, an ellipse
 * or arc, a line, a polygon or star, or a vector's network. Null for other layers.
 */
export function nodeOutlinePath(node: OutlineNode): string | null {
  switch (node.type) {
    case 'RECTANGLE':
      return boxOutlinePath(node)
    case 'ELLIPSE':
      return arcPath(node)
    case 'LINE':
      return `M0 0L${round(node.width)} ${round(node.height)}`
    case 'POLYGON':
    case 'STAR':
      return outlineSVGPath(polygonOutline(node), (value) => round(value))
    case 'VECTOR':
      return node.vectorNetwork ? vectorNetworkToSVGPaths(node.vectorNetwork).join('') : null
    default:
      return null
  }
}

/** A FigJam shape's outline in its own box as path data, with its corner radius. */
export function shapeWithTextOutlinePath(
  node: Pick<SceneNode, 'shapeWithTextType' | 'width' | 'height' | 'cornerRadius'>
): string {
  const { outline } = shapeWithTextGeometry(
    node.shapeWithTextType,
    node.width,
    node.height,
    node.cornerRadius
  )
  return outlineSVGPath(outline, (value) => round(value))
}

/**
 * A FigJam shape's stroke-only inner lines, such as a database's front rim, as path data; null for
 * a shape without any.
 */
export function shapeWithTextDetailsPath(
  node: Pick<SceneNode, 'shapeWithTextType' | 'width' | 'height'>
): string | null {
  const { details } = shapeWithTextGeometry(node.shapeWithTextType, node.width, node.height)
  return details.length > 0 ? outlineSVGPath(details, (value) => round(value)) : null
}

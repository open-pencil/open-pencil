import { compact } from 'es-toolkit/array'

import type { SceneNode } from '@open-pencil/scene-graph'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'
import { outlineSVGPath, polygonOutline } from '@open-pencil/scene-graph/polygon'
import { shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'
import { vectorNetworkToSVGPaths } from '@open-pencil/scene-graph/vector-network'

import { traceSmoothRect, type SmoothCornerSink } from '#core/canvas/paths/smooth-corners'
import { nodeHasRadius } from '#core/canvas/shapes'
import type { PathSink } from '#core/vector/path-helpers'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_QUAD_TO = 3
const CMD_CUBIC_TO = 4

export function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function coordinate(value: number, decimals: number | null): number {
  return decimals === null ? value : round(value, decimals)
}

export function geometryBlobToSVGPath(blob: Uint8Array, decimals: number | null = 2): string {
  if (blob.length === 0) return ''
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0
  const parts: string[] = []

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case CMD_CLOSE:
        parts.push('Z')
        break
      case CMD_MOVE_TO: {
        const x = coordinate(dv.getFloat32(o, true), decimals)
        const y = coordinate(dv.getFloat32(o + 4, true), decimals)
        o += 8
        parts.push(`M${x} ${y}`)
        break
      }
      case CMD_LINE_TO: {
        const x = coordinate(dv.getFloat32(o, true), decimals)
        const y = coordinate(dv.getFloat32(o + 4, true), decimals)
        o += 8
        parts.push(`L${x} ${y}`)
        break
      }
      case CMD_QUAD_TO: {
        const x1 = coordinate(dv.getFloat32(o, true), decimals)
        const y1 = coordinate(dv.getFloat32(o + 4, true), decimals)
        const x = coordinate(dv.getFloat32(o + 8, true), decimals)
        const y = coordinate(dv.getFloat32(o + 12, true), decimals)
        o += 16
        parts.push(`Q${x1} ${y1} ${x} ${y}`)
        break
      }
      case CMD_CUBIC_TO: {
        const x1 = coordinate(dv.getFloat32(o, true), decimals)
        const y1 = coordinate(dv.getFloat32(o + 4, true), decimals)
        const x2 = coordinate(dv.getFloat32(o + 8, true), decimals)
        const y2 = coordinate(dv.getFloat32(o + 12, true), decimals)
        const x = coordinate(dv.getFloat32(o + 16, true), decimals)
        const y = coordinate(dv.getFloat32(o + 20, true), decimals)
        o += 24
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`)
        break
      }
      default:
        return parts.join('')
    }
  }

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

export const hasRadius = nodeHasRadius

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
  let tl: number, tr: number, br: number, bl: number
  if (node.independentCorners) {
    tl = node.topLeftRadius
    tr = node.topRightRadius
    br = node.bottomRightRadius
    bl = node.bottomLeftRadius
  } else {
    tl = tr = br = bl = node.cornerRadius
  }

  tl = Math.min(tl, w / 2, h / 2)
  tr = Math.min(tr, w / 2, h / 2)
  br = Math.min(br, w / 2, h / 2)
  bl = Math.min(bl, w / 2, h / 2)

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

export function arcPath(node: Pick<SceneNode, 'width' | 'height' | 'arcData'>): string {
  if (!node.arcData) return ''
  const { startingAngle, endingAngle, innerRadius } = node.arcData
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2

  const fullCircle = Math.abs(endingAngle - startingAngle) >= Math.PI * 2 - 0.001
  const ring = (rx: number, ry: number, sweep: 0 | 1) =>
    `M${round(cx - rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 ${sweep} ${round(cx + rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 ${sweep} ${round(cx - rx)} ${round(cy)}Z`
  // A whole ring has no ends to join: it is its outer edge and, for a donut, its hole, wound
  // the other way so the default nonzero fill leaves the hole empty.
  if (fullCircle) {
    const outer = ring(rx, ry, 1)
    return innerRadius > 0 ? outer + ring(rx * innerRadius, ry * innerRadius, 0) : outer
  }

  const x1 = round(cx + rx * Math.cos(startingAngle))
  const y1 = round(cy + ry * Math.sin(startingAngle))
  const x2 = round(cx + rx * Math.cos(endingAngle))
  const y2 = round(cy + ry * Math.sin(endingAngle))
  const largeArc = Math.abs(endingAngle - startingAngle) > Math.PI ? 1 : 0
  const sweep = endingAngle > startingAngle ? 1 : 0

  const parts = [`M${x1} ${y1}`, `A${round(rx)} ${round(ry)} 0 ${largeArc} ${sweep} ${x2} ${y2}`]

  if (innerRadius > 0) {
    const irx = rx * innerRadius
    const iry = ry * innerRadius
    const ix1 = round(cx + irx * Math.cos(endingAngle))
    const iy1 = round(cy + iry * Math.sin(endingAngle))
    const ix2 = round(cx + irx * Math.cos(startingAngle))
    const iy2 = round(cy + iry * Math.sin(startingAngle))
    parts.push(`L${ix1} ${iy1}`)
    parts.push(`A${round(irx)} ${round(iry)} 0 ${largeArc} ${sweep === 1 ? 0 : 1} ${ix2} ${iy2}`)
    parts.push('Z')
  } else {
    parts.push(`L${round(cx)} ${round(cy)}Z`)
  }

  return parts.join('')
}

/** Path commands written as SVG path data into `parts`, as the canvas would build a path. */
export function svgPathSink(parts: string[]): PathSink {
  const point = (x: number, y: number) => `${round(x)} ${round(y)}`
  return {
    moveTo: (x, y) => parts.push(`M${point(x, y)}`),
    lineTo: (x, y) => parts.push(`L${point(x, y)}`),
    cubicTo: (x1, y1, x2, y2, x, y) =>
      parts.push(`C${point(x1, y1)} ${point(x2, y2)} ${point(x, y)}`),
    close: () => parts.push('Z')
  }
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

/** What a layer's outline is drawn from. */
export type OutlineNode = RectOutlineNode &
  Pick<
    SceneNode,
    'type' | 'arcData' | 'pointCount' | 'starInnerRadius' | 'cornerSmoothing' | 'vectorNetwork'
  >

const FULL_ELLIPSE = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0 }

/**
 * A shape layer's outline in its own box as path data: a rectangle with its corners, an ellipse
 * or arc, a line, a polygon or star, or a vector's network. Null for other layers.
 */
export function nodeOutlinePath(node: OutlineNode): string | null {
  switch (node.type) {
    case 'RECTANGLE':
      return node.cornerSmoothing > 0 ? smoothRectPath(node) : roundedRectPath(node)
    case 'ELLIPSE':
      return arcPath({ ...node, arcData: node.arcData ?? FULL_ELLIPSE })
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

import {
  readIcon,
  readIconTint,
  withIcon,
  withIconTint,
  type IconPaint,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { BLACK } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { createPathStroke, pathStrokeLineStyle } from '#core/icons/path-style'

import type { IconData, IconPath } from './types'

/** The paint an SVG uses for the icon's own color. */
const CURRENT_COLOR = 'currentColor'

export interface PlaceIconOptions {
  size: number
  /** What `currentColor` paints become; paths with their own colors keep them. */
  color: Color
  /** Fields of the icon's frame, such as its position or name. */
  overrides?: Partial<SceneNode>
  /**
   * Record the icon's name on its frame, so it can be swapped and exported as that icon. Off for
   * artwork that has no name in a set, such as inline SVG.
   */
  identity?: boolean
}

function solid(color: Color) {
  return [{ type: 'SOLID' as const, color, opacity: 1, visible: true }]
}

/** One path of an icon as a vector filling the icon's box, marked where the icon's color paints. */
function addPath(graph: SceneGraph, frameId: string, path: IconPath, size: number, color: Color) {
  const tint: IconPaint[] = []
  const paint = (value: string, kind: IconPaint) => {
    if (value !== CURRENT_COLOR) return parseColor(value)
    tint.push(kind)
    return color
  }
  const vector = graph.createNode('VECTOR', frameId, {
    name: 'path',
    x: 0,
    y: 0,
    width: size,
    height: size,
    vectorNetwork: path.vectorNetwork,
    fills: path.fill ? solid(paint(path.fill, 'fill')) : []
  })
  if (path.stroke) {
    const stroke = createPathStroke(
      paint(path.stroke, 'stroke'),
      path.strokeWidth,
      path.strokeCap,
      path.strokeJoin
    )
    graph.updateNode(vector.id, { strokes: [stroke], ...pathStrokeLineStyle(stroke) })
  }
  if (tint.length > 0)
    graph.updateNode(vector.id, {
      pluginData: withIconTint(graph.getNode(vector.id) ?? vector, tint)
    })
}

/**
 * An icon as a frame of vector paths that keeps the icon's name, so it can be swapped,
 * recolored, and exported as an icon rather than as anonymous paths.
 */
export function placeIcon(
  graph: SceneGraph,
  parentId: string,
  icon: IconData,
  { size, color, overrides, identity = true }: PlaceIconOptions
): SceneNode {
  const name = `${icon.prefix}:${icon.name}`
  const frame = graph.createNode('FRAME', parentId, {
    name: identity ? `Icon / ${name}` : icon.name,
    width: size,
    height: size,
    fills: [],
    ...overrides
  })
  if (identity) graph.updateNode(frame.id, { pluginData: withIcon(frame, { name }) })
  for (const path of icon.paths) addPath(graph, frame.id, path, size, color)
  return graph.getNode(frame.id) ?? frame
}

/** The color an icon's tinted paths have, or null when none takes the icon's color. */
export function iconColor(graph: SceneGraph, frame: SceneNode): Color | null {
  for (const path of graph.getChildren(frame.id)) {
    const tint = readIconTint(path)
    if (tint.includes('fill') && path.fills[0]) return path.fills[0].color
    if (tint.includes('stroke') && path.strokes[0]) return path.strokes[0].color
  }
  return null
}

/** Sets the color of an icon's tinted paints; paths with colors of their own keep them. */
export function recolorIcon(graph: SceneGraph, frameId: string, color: Color): void {
  for (const path of graph.getChildren(frameId)) {
    const tint = readIconTint(path)
    if (tint.includes('fill'))
      graph.updateNode(path.id, { fills: path.fills.map((fill) => ({ ...fill, color })) })
    if (tint.includes('stroke'))
      graph.updateNode(path.id, { strokes: path.strokes.map((stroke) => ({ ...stroke, color })) })
  }
}

/**
 * Draws another icon in an icon's frame, keeping its size, position, and color, so the
 * swap reads as a change of glyph. Does nothing to a frame that is not an icon.
 */
export function swapIcon(graph: SceneGraph, frameId: string, icon: IconData): void {
  const frame = graph.getNode(frameId)
  if (!frame || !readIcon(frame)) return
  const color = iconColor(graph, frame) ?? BLACK
  const size = Math.min(frame.width, frame.height)
  for (const child of graph.getChildren(frameId)) graph.deleteNode(child.id)
  const name = `${icon.prefix}:${icon.name}`
  graph.updateNode(frameId, {
    name: frame.name.startsWith('Icon / ') ? `Icon / ${name}` : frame.name,
    pluginData: withIcon(frame, { name })
  })
  for (const path of icon.paths) addPath(graph, frameId, path, size, color)
}

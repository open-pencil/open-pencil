import {
  iconGlyph,
  iconLayerName,
  isPlacedIconName,
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
import {
  createResizeSnapshot,
  scaledChildRect,
  scaledGeometryChanges
} from '@open-pencil/scene-graph/resize'

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
    // Resizing the icon resizes its glyph, as the frame is the icon.
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'SCALE',
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
    name: identity ? iconLayerName(name) : icon.name,
    width: size,
    height: size,
    fills: [],
    ...overrides
  })
  for (const path of icon.paths) addPath(graph, frame.id, path, size, color)
  if (identity) recordIcon(graph, frame.id, name)
  return graph.getNode(frame.id) ?? frame
}

/** Writes the icon `name` on its frame with a fingerprint of the paths it draws now. */
function recordIcon(graph: SceneGraph, frameId: string, name: string): void {
  const frame = graph.getNode(frameId)
  if (!frame) return
  const glyph = iconGlyph(graph, frame)
  graph.updateNode(frameId, { pluginData: withIcon(frame, { name, glyph }) })
}

/**
 * Makes an icon plain artwork: its frame forgets the icon and its paths their tint, so it is
 * no longer swapped, recolored as one, or exported as `<Icon>`. The paths stay as drawn.
 */
export function detachIcon(graph: SceneGraph, frameId: string): void {
  const frame = graph.getNode(frameId)
  if (!frame || !readIcon(frame)) return
  graph.updateNode(frameId, { pluginData: withIcon(frame, null) })
  for (const path of graph.getChildren(frameId))
    if (readIconTint(path).length > 0)
      graph.updateNode(path.id, { pluginData: withIconTint(path, []) })
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
 * Draws another icon in an icon's frame, keeping its position and color, so the swap reads as
 * a change of glyph. `icon` is built square, at the frame's shorter side, and stretched to the
 * frame. Does nothing to a frame that is not an icon.
 */
export function swapIcon(graph: SceneGraph, frameId: string, icon: IconData): void {
  const frame = graph.getNode(frameId)
  if (!frame || !readIcon(frame)) return
  const color = iconColor(graph, frame) ?? BLACK
  // The paths are scaled to the size the icon was built at; their boxes must match it.
  const size = icon.width
  for (const child of graph.getChildren(frameId)) graph.deleteNode(child.id)
  const name = `${icon.prefix}:${icon.name}`
  const previous = readIcon(frame)
  graph.updateNode(frameId, {
    // A layer still named after its icon takes the new icon's name; a name someone gave stays.
    name: previous && isPlacedIconName(frame.name, previous.name) ? iconLayerName(name) : frame.name
  })
  for (const path of icon.paths) addPath(graph, frameId, path, size, color)
  fitPaths(graph, frameId, size)
  recordIcon(graph, frameId, name)
}

/**
 * Stretches paths drawn in a `size` square to their frame, as a resize would, so an icon that
 * was resized unevenly is swapped or reset at the shape it has rather than as a square.
 */
function fitPaths(graph: SceneGraph, frameId: string, size: number): void {
  const frame = graph.getNode(frameId)
  if (!frame || (frame.width === size && frame.height === size)) return
  const square = { width: size, height: size }
  for (const path of graph.getChildren(frameId)) {
    const rect = scaledChildRect(path, square, frame)
    graph.updateNode(path.id, {
      ...rect,
      ...scaledGeometryChanges(
        createResizeSnapshot(path),
        path.width,
        path.height,
        rect.width,
        rect.height
      )
    })
  }
}

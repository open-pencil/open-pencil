import type { Canvas } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { strokeOverflow as strokeReach } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { regionFills } from '@open-pencil/scene-graph/vector-network'

import { paintBooleanOperation } from '#core/canvas/boolean'
import { renderMaskedChildIds } from '#core/canvas/masks'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { nodeHasRadius, nodeHasSmoothCorners } from '#core/canvas/shapes'
import { strokeAlignShare } from '#core/canvas/strokes/sides'
import { nodeOrientationMatrix } from '#core/geometry'

/**
 * What a shadow is cast from (`cast`) or hidden under when it does not show behind the node
 * (`knockout`). Measured on Figma 126: a layer casts from the outline of every paint above 0%
 * opacity, its children included, at full strength; it hides the shadow under every shape it
 * draws, a shape's area included even at 0% fill, but a container's area only when the container
 * paints something itself or clips its content.
 */
export type SilhouetteMode = 'cast' | 'knockout'

const SILHOUETTE_PAINT: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

/**
 * Figma casts a full-strength shadow from any paint above 0% opacity and none from a paint at
 * 0% or a gradient whose stops are all transparent, so such a paint counts as no paint at all.
 */
export function paintCastsShadow(paint: Fill): boolean {
  if (!paint.visible || paint.opacity === 0) return false
  return paint.gradientStops?.some((stop) => stop.color.a > 0) ?? true
}

/** Frames, groups, and the like, whose shadows Figma casts from their children as well. */
export function fillsCastShadow(node: SceneNode): boolean {
  return node.fills.some(paintCastsShadow) || regionFills(node.vectorNetwork).some(paintCastsShadow)
}

export function paintsCastShadow(node: SceneNode): boolean {
  return fillsCastShadow(node) || node.strokes.some(paintCastsShadow)
}

function clipsChildren(node: SceneNode): boolean {
  return node.clipsContent && node.type !== 'GROUP'
}

function drawsSilhouette(node: SceneNode): boolean {
  return node.visible && !node.internalOnly && node.opacity > 0
}

/** Whether a container has a child that draws, which its shadows then include. */
export function hasDrawnChildren(graph: SceneGraph, node: SceneNode): boolean {
  if (!isLayerContainer(node)) return false
  return node.childIds.some((id) => {
    const child = graph.getNode(id)
    return child !== undefined && drawsSilhouette(child) && !child.isMask
  })
}

function silhouetteStroke(stroke: Stroke): Stroke {
  return { ...stroke, ...SILHOUETTE_PAINT, blendMode: undefined }
}

/** The node with its shadow-casting paints made opaque and no effects, or null when it draws none. */
function silhouetteProxy(node: SceneNode, mode: SilhouetteMode): SceneNode | null {
  const strokes = node.strokes.filter(paintCastsShadow).map(silhouetteStroke)
  const castsFill = fillsCastShadow(node)
  const coversArea =
    mode === 'knockout' &&
    (!isLayerContainer(node) || castsFill || strokes.length > 0 || clipsChildren(node))
  const fills = castsFill || coversArea ? [SILHOUETTE_PAINT] : []
  if (fills.length === 0 && strokes.length === 0) return null
  return {
    ...node,
    fills,
    strokes,
    vectorNetwork: node.vectorNetwork && {
      ...node.vectorNetwork,
      regions: node.vectorNetwork.regions.map((region) =>
        region.fills
          ? {
              ...region,
              fills: coversArea || region.fills.some(paintCastsShadow) ? [SILHOUETTE_PAINT] : []
            }
          : region
      )
    },
    effects: [],
    boundVariables: {}
  }
}

/** Draws what the node casts or hides a shadow under, opaque, in its own coordinates. */
export function drawSilhouette(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  mode: SilhouetteMode,
  includeChildren: boolean
): void {
  const proxy = silhouetteProxy(node, mode)
  if (proxy?.type === 'BOOLEAN_OPERATION') paintBooleanOperation(r, canvas, proxy, graph)
  else if (proxy) r.paintShapeContent(canvas, proxy, graph)
  if (includeChildren && isLayerContainer(node)) drawChildSilhouettes(r, canvas, graph, node, mode)
}

function drawChildSilhouettes(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  mode: SilhouetteMode
): void {
  const drawChild = (childId: string) => {
    const child = graph.getNode(childId)
    if (!child || !drawsSilhouette(child)) return
    canvas.save()
    canvas.translate(child.x, child.y)
    canvas.concat(nodeOrientationMatrix(child))
    drawSilhouette(r, canvas, graph, child, mode, true)
    canvas.restore()
  }
  canvas.save()
  try {
    if (clipsChildren(node)) {
      r.clipNodeShape(canvas, node)
    }
    renderMaskedChildIds(
      r,
      canvas,
      node.childIds,
      (childId) => {
        const child = graph.getNode(childId)
        return child && drawsSilhouette(child) && child.isMask ? child.maskType : null
      },
      drawChild,
      drawChild,
      (childId) => childBox(graph, childId)
    )
  } finally {
    canvas.restore()
  }
}

/** How far a stroke reaches past the shape it outlines. */
export function strokeOutset(stroke: Stroke): number {
  return stroke.weight * strokeAlignShare(stroke.align)
}

function strokeOverflow(node: SceneNode): number {
  let overflow = 0
  for (const stroke of node.strokes) {
    if (!paintCastsShadow(stroke)) continue
    // A line's stroke lies wholly to one side of it, whatever its alignment, with its heads.
    const reach =
      node.type === 'LINE'
        ? strokeReach([stroke], node.strokeCap, null, node)
        : strokeOutset(stroke)
    overflow = Math.max(overflow, reach)
  }
  return overflow
}

function isOpaquePaint(paint: Fill): boolean {
  return (
    paint.visible &&
    paint.type === 'SOLID' &&
    paint.opacity === 1 &&
    paint.color.a === 1 &&
    (paint.blendMode === undefined || paint.blendMode === 'NORMAL')
  )
}

function paintsOverOwnKnockout(node: SceneNode): boolean {
  const strokes = node.strokes.filter(paintCastsShadow)
  const coversArea =
    !isLayerContainer(node) || fillsCastShadow(node) || strokes.length > 0 || clipsChildren(node)
  if (coversArea && !node.fills.some(isOpaquePaint)) return false
  return strokes.every((stroke) => stroke.align === 'INSIDE' || isOpaquePaint(stroke))
}

/**
 * Whether the layer paints opaquely over everything its knockout would clear, so the shadow
 * hidden under it is hidden anyway and the knockout can be skipped.
 */
export function paintsOverKnockout(
  graph: SceneGraph,
  node: SceneNode,
  includeChildren: boolean
): boolean {
  if (!paintsOverOwnKnockout(node)) return false
  if (!includeChildren || !isLayerContainer(node)) return true
  return node.childIds.every((id) => {
    const child = graph.getNode(id)
    if (!child || !drawsSilhouette(child)) return true
    const blends = child.blendMode !== 'NORMAL' && child.blendMode !== 'PASS_THROUGH'
    if (child.isMask || child.opacity < 1 || blends) return false
    return paintsOverKnockout(graph, child, true)
  })
}

function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  }
}

/** The box a child's silhouette can cover, in its parent's coordinates. */
function childBox(graph: SceneGraph, childId: string): Rect | null {
  const child = graph.getNode(childId)
  if (!child || !drawsSilhouette(child)) return null
  const local = silhouetteBounds(graph, child, true)
  if (!local) return null
  const matrix = Matrix.multiply(Matrix.translated(child.x, child.y), nodeOrientationMatrix(child))
  const points = Matrix.mapPoints(matrix, [
    local.x,
    local.y,
    local.x + local.width,
    local.y,
    local.x + local.width,
    local.y + local.height,
    local.x,
    local.y + local.height
  ])
  const xs = [points[0], points[2], points[4], points[6]]
  const ys = [points[1], points[3], points[5], points[7]]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function childrenBounds(graph: SceneGraph, node: SceneNode): Rect | null {
  let bounds: Rect | null = null
  for (const childId of node.childIds) bounds = unionRect(bounds, childBox(graph, childId))
  if (!bounds || !clipsChildren(node)) return bounds
  const x = Math.max(bounds.x, 0)
  const y = Math.max(bounds.y, 0)
  const right = Math.min(bounds.x + bounds.width, node.width)
  const bottom = Math.min(bounds.y + bounds.height, node.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

/** The box the node's silhouette can cover, in its own coordinates, strokes included. */
export function silhouetteBounds(
  graph: SceneGraph,
  node: SceneNode,
  includeChildren: boolean
): Rect | null {
  const overflow = strokeOverflow(node)
  const own: Rect = {
    x: -overflow,
    y: -overflow,
    width: node.width + overflow * 2,
    height: node.height + overflow * 2
  }
  if (!includeChildren || !isLayerContainer(node)) return own
  return unionRect(own, childrenBounds(graph, node))
}

/**
 * Whether a point lies inside the node's rectangle and rounded corners. Corner smoothing pulls a
 * corner further in, so a smoothed corner is checked as a circle of the longer smoothed radius.
 */
function pointInShape(node: SceneNode, x: number, y: number): boolean {
  const epsilon = 0.01
  if (x < -epsilon || y < -epsilon || x > node.width + epsilon || y > node.height + epsilon) {
    return false
  }
  if (!nodeHasRadius(node)) return true
  const smoothing = nodeHasSmoothCorners(node) ? 1 + node.cornerSmoothing : 1
  const radius = (value: number) => Math.min(value * smoothing, node.width / 2, node.height / 2)
  const corners = node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
    : [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius]
  const [topLeft, topRight, bottomRight, bottomLeft] = corners.map(radius)
  const outsideCorner = (cx: number, cy: number, r: number, inCorner: boolean) =>
    inCorner && Math.hypot(x - cx, y - cy) > r + epsilon
  return !(
    outsideCorner(topLeft, topLeft, topLeft, x < topLeft && y < topLeft) ||
    outsideCorner(
      node.width - topRight,
      topRight,
      topRight,
      x > node.width - topRight && y < topRight
    ) ||
    outsideCorner(
      node.width - bottomRight,
      node.height - bottomRight,
      bottomRight,
      x > node.width - bottomRight && y > node.height - bottomRight
    ) ||
    outsideCorner(
      bottomLeft,
      node.height - bottomLeft,
      bottomLeft,
      x < bottomLeft && y > node.height - bottomLeft
    )
  )
}

/** The node's shape is convex, so a box lies inside it when its four corners do. */
function shapeContainsBox(node: SceneNode, box: Rect): boolean {
  const right = box.x + box.width
  const bottom = box.y + box.height
  return (
    pointInShape(node, box.x, box.y) &&
    pointInShape(node, right, box.y) &&
    pointInShape(node, right, bottom) &&
    pointInShape(node, box.x, bottom)
  )
}

/**
 * Whether a container's shadows have to include its children: they do unless the container's
 * own fill already covers everything they draw.
 */
export function shadowIncludesChildren(graph: SceneGraph, node: SceneNode): boolean {
  if (!hasDrawnChildren(graph, node)) return false
  if (!fillsCastShadow(node)) return true
  if (clipsChildren(node)) return false
  const bounds = childrenBounds(graph, node)
  return bounds !== null && !shapeContainsBox(node, bounds)
}

/** Most children `separateShadowChildren` compares pair by pair before it leaves them to the layer. */
const MAX_SEPARATE_CHILDREN = 32

/** Whether two boxes are more than `gap` apart along either axis. */
function apart(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  )
}

/**
 * The children a container's shadows come from, each casting on its own, when the container
 * paints nothing itself and does not clip, no child is a mask or brings children of its own, and
 * every two children are more than `gap` apart; null otherwise. Shadows that reach neither each
 * other nor another child draw the same one by one, turned with each child, as from the whole
 * layer.
 */
export function separateShadowChildren(
  graph: SceneGraph,
  node: SceneNode,
  gap: number
): SceneNode[] | null {
  if (!isLayerContainer(node) || paintsCastShadow(node) || clipsChildren(node)) return null
  const children: SceneNode[] = []
  for (const id of node.childIds) {
    const child = graph.getNode(id)
    if (!child || !drawsSilhouette(child)) continue
    if (child.isMask || children.length === MAX_SEPARATE_CHILDREN) return null
    if (isLayerContainer(child) && shadowIncludesChildren(graph, child)) return null
    children.push(child)
  }
  if (children.length < 2) return children.length === 1 ? children : null
  const boxes: Rect[] = []
  for (const child of children) {
    const box = childBox(graph, child.id)
    if (!box || boxes.some((other) => !apart(box, other, gap))) return null
    boxes.push(box)
  }
  return children
}

import type { Effect, Stroke } from './scene-graph'
import type { Rect, Vector } from './types'

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, rad: number): Vector {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos
  }
}

export function rotatedCorners(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rotationDeg: number
): [Vector, Vector, Vector, Vector] {
  const rad = degToRad(rotationDeg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    { x: cx + -hw * cos - -hh * sin, y: cy + -hw * sin + -hh * cos },
    { x: cx + hw * cos - -hh * sin, y: cy + hw * sin + -hh * cos },
    { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
    { x: cx + -hw * cos - hh * sin, y: cy + -hw * sin + hh * cos }
  ]
}

export function rotatedBBox(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number
): { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number } {
  if (rotationDeg === 0) {
    return {
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      centerX: x + w / 2,
      centerY: y + h / 2
    }
  }
  const corners = rotatedCorners(x + w / 2, y + h / 2, w / 2, h / 2, rotationDeg)
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity
  for (const c of corners) {
    left = Math.min(left, c.x)
    right = Math.max(right, c.x)
    top = Math.min(top, c.y)
    bottom = Math.max(bottom, c.y)
  }
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 }
}

export function computeBounds(items: Iterable<Rect>): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const item of items) {
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function strokeOverflow(strokes?: Stroke[]): number {
  let overflow = 0
  for (const stroke of strokes ?? []) {
    if (!stroke.visible) continue
    let extra = 0
    if (stroke.align === 'OUTSIDE') extra = stroke.weight
    else if (stroke.align === 'CENTER') extra = stroke.weight / 2
    overflow = Math.max(overflow, extra)
  }
  return overflow
}

function effectOverflow(effects?: Effect[]) {
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0

  for (const effect of effects ?? []) {
    if (!effect.visible) continue
    if (
      effect.type !== 'DROP_SHADOW' &&
      effect.type !== 'LAYER_BLUR' &&
      effect.type !== 'FOREGROUND_BLUR'
    ) {
      continue
    }
    const blurSpread = effect.radius + effect.spread
    left = Math.max(left, blurSpread + Math.max(0, -effect.offset.x))
    right = Math.max(right, blurSpread + Math.max(0, effect.offset.x))
    top = Math.max(top, blurSpread + Math.max(0, -effect.offset.y))
    bottom = Math.max(bottom, blurSpread + Math.max(0, effect.offset.y))
  }

  return { left, right, top, bottom }
}

export function computeAbsoluteBounds(
  nodes: Iterable<{ id: string; width: number; height: number }>,
  getAbsolutePosition: (id: string) => Vector
): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of nodes) {
    const abs = getAbsolutePosition(n.id)
    minX = Math.min(minX, abs.x)
    minY = Math.min(minY, abs.y)
    maxX = Math.max(maxX, abs.x + n.width)
    maxY = Math.max(maxY, abs.y + n.height)
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function computeVisualBounds(
  nodes: Iterable<{
    id: string
    width: number
    height: number
    rotation?: number
    strokes?: Stroke[]
    effects?: Effect[]
  }>,
  getAbsolutePosition: (id: string) => Vector
): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const n of nodes) {
    const abs = getAbsolutePosition(n.id)
    const bbox = rotatedBBox(abs.x, abs.y, n.width, n.height, n.rotation ?? 0)
    const stroke = strokeOverflow(n.strokes)
    const effects = effectOverflow(n.effects)
    minX = Math.min(minX, bbox.left - stroke - effects.left)
    minY = Math.min(minY, bbox.top - stroke - effects.top)
    maxX = Math.max(maxX, bbox.right + stroke + effects.right)
    maxY = Math.max(maxY, bbox.bottom + stroke + effects.bottom)
  }

  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export interface VisualBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface VisualBoundsNode {
  id: string
  width: number
  height: number
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  strokes?: Stroke[]
  effects?: Effect[]
  fillGeometry?: Array<{ commandsBlob: Uint8Array }>
  strokeGeometry?: Array<{ commandsBlob: Uint8Array }>
  childIds?: string[]
  visible?: boolean
  type?: string
  clipsContent?: boolean
}

export function unionVisualBounds(
  a: VisualBounds | null,
  b: VisualBounds | null
): VisualBounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

export function intersectVisualBounds(a: VisualBounds, b: VisualBounds): VisualBounds | null {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.maxX, b.maxX)
  const maxY = Math.min(a.maxY, b.maxY)
  return minX < maxX && minY < maxY ? { minX, minY, maxX, maxY } : null
}

function geometryCommandCoordCount(command: number): number | null {
  if (command === 0) return 0
  if (command === 1 || command === 2) return 1
  if (command === 4) return 3
  return null
}

export function geometryBlobBounds(paths: Array<{ commandsBlob: Uint8Array }>): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const path of paths) {
    const blob = path.commandsBlob
    const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
    let offset = 0
    while (offset < blob.length) {
      const command = blob[offset++]
      const coords = geometryCommandCoordCount(command)
      if (coords == null) break
      for (let i = 0; i < coords; i++) {
        if (offset + 8 > blob.length) break
        const x = dv.getFloat32(offset, true)
        const y = dv.getFloat32(offset + 4, true)
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        offset += 8
      }
    }
  }

  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function transformLocalPoint(node: VisualBoundsNode, point: Vector): Vector {
  let x = node.flipX ? node.width - point.x : point.x
  let y = node.flipY ? node.height - point.y : point.y
  const rotation = node.rotation ?? 0
  if (rotation !== 0) {
    const rotated = rotatePoint(x, y, node.width / 2, node.height / 2, degToRad(rotation))
    x = rotated.x
    y = rotated.y
  }
  return { x, y }
}

function transformedLocalBounds(node: VisualBoundsNode, local: Rect, abs: Vector): VisualBounds {
  const points = [
    { x: local.x, y: local.y },
    { x: local.x + local.width, y: local.y },
    { x: local.x + local.width, y: local.y + local.height },
    { x: local.x, y: local.y + local.height }
  ].map((point) => transformLocalPoint(node, point))

  return {
    minX: abs.x + Math.min(...points.map((point) => point.x)),
    minY: abs.y + Math.min(...points.map((point) => point.y)),
    maxX: abs.x + Math.max(...points.map((point) => point.x)),
    maxY: abs.y + Math.max(...points.map((point) => point.y))
  }
}

export function nodeVisualBounds(
  node: VisualBoundsNode,
  getAbsolutePosition: (id: string) => Vector
): VisualBounds {
  const abs = getAbsolutePosition(node.id)
  const base = computeVisualBounds([node], getAbsolutePosition)
  let bounds: VisualBounds = {
    minX: base.x,
    minY: base.y,
    maxX: base.x + base.width,
    maxY: base.y + base.height
  }

  const localGeometry = geometryBlobBounds([
    ...(node.fillGeometry ?? []),
    ...(node.strokeGeometry ?? [])
  ])
  if (localGeometry) {
    bounds = unionVisualBounds(bounds, transformedLocalBounds(node, localGeometry, abs)) ?? bounds
  }

  return bounds
}

function collectDescendantVisualBounds(
  nodeId: string,
  getNode: (id: string) => VisualBoundsNode | undefined,
  getAbsolutePosition: (id: string) => Vector,
  clip: VisualBounds | null = null
): VisualBounds | null {
  const node = getNode(nodeId)
  if (!node?.visible) return null

  const own = nodeVisualBounds(node, getAbsolutePosition)
  let bounds = clip ? intersectVisualBounds(own, clip) : own

  const isClippableContainer =
    node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  let childClip = clip
  if (isClippableContainer && node.clipsContent) {
    const abs = getAbsolutePosition(node.id)
    const nodeClip = {
      minX: abs.x,
      minY: abs.y,
      maxX: abs.x + node.width,
      maxY: abs.y + node.height
    }
    childClip = childClip ? intersectVisualBounds(childClip, nodeClip) : nodeClip
  }

  for (const childId of node.childIds ?? []) {
    bounds = unionVisualBounds(
      bounds,
      collectDescendantVisualBounds(childId, getNode, getAbsolutePosition, childClip)
    )
  }

  return bounds
}

export function computeDescendantVisualBounds(
  nodeIds: string[],
  getNode: (id: string) => VisualBoundsNode | undefined,
  getAbsolutePosition: (id: string) => Vector
): VisualBounds | null {
  let bounds: VisualBounds | null = null
  for (const nodeId of nodeIds) {
    bounds = unionVisualBounds(
      bounds,
      collectDescendantVisualBounds(nodeId, getNode, getAbsolutePosition)
    )
  }
  return bounds
}

import type {
  BlendMode,
  Fill,
  FillType,
  GradientStop,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin
} from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import {
  ellipticalGradientTransform,
  linearGradientTransformFromAxes
} from '@open-pencil/scene-graph/gradient'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { imagePaint, type PenImages } from './images'
import type {
  PenGradientPaint,
  PenImagePaint,
  PenLegacyStroke,
  PenNode,
  PenOverride,
  PenPaint,
  PenPaints,
  PenSides
} from './schema'
import {
  bindIfVar,
  resolveBoolean,
  resolveColor,
  resolveNumber,
  type VarContext
} from './variables'

type PaintField = 'fills' | 'strokes'

/**
 * pen.dev blend modes by name. Linear burn and linear dodge have no counterpart in the scene
 * graph, so they draw as normal.
 */
const BLEND_MODES: Partial<Record<string, BlendMode>> = {
  normal: 'NORMAL',
  darken: 'DARKEN',
  multiply: 'MULTIPLY',
  colorBurn: 'COLOR_BURN',
  light: 'LIGHTEN',
  screen: 'SCREEN',
  colorDodge: 'COLOR_DODGE',
  overlay: 'OVERLAY',
  softLight: 'SOFT_LIGHT',
  hardLight: 'HARD_LIGHT',
  difference: 'DIFFERENCE',
  exclusion: 'EXCLUSION',
  hue: 'HUE',
  saturation: 'SATURATION',
  color: 'COLOR',
  luminosity: 'LUMINOSITY'
}

export function mapBlendMode(value: string | undefined): BlendMode | undefined {
  return value === undefined ? undefined : BLEND_MODES[value]
}

const GRADIENT_TYPES: Partial<Record<string, FillType>> = {
  linear: 'GRADIENT_LINEAR',
  radial: 'GRADIENT_RADIAL',
  angular: 'GRADIENT_ANGULAR'
}

/**
 * pen.dev places a gradient in the layer's unit square: `center` defaults to the middle, a linear
 * gradient runs `size.height` long from bottom to top, radial and angular ones are ellipses of
 * diameter `size`, and `rotation` turns all of it counter-clockwise in that square. An angular
 * gradient starts at the top and turns clockwise. Measured against pen.dev 2.21 renders.
 */
function gradientTransform(paint: PenGradientPaint, type: FillType, ctx: VarContext) {
  const center = { x: paint.center?.x ?? 0.5, y: paint.center?.y ?? 0.5 }
  const width = resolveNumber(paint.size?.width, ctx, 1)
  const height = resolveNumber(paint.size?.height, ctx, 1)
  const angle = (resolveNumber(paint.rotation, ctx) * Math.PI) / 180
  // Up, and right, after turning counter-clockwise on a y-down canvas.
  const up = { x: -Math.sin(angle), y: -Math.cos(angle) }
  const right = { x: Math.cos(angle), y: -Math.sin(angle) }
  const along = (direction: Vector, length: number): Vector => ({
    x: center.x + direction.x * length,
    y: center.y + direction.y * length
  })
  if (type === 'GRADIENT_LINEAR') {
    return linearGradientTransformFromAxes(along(up, -height / 2), along(up, height / 2), {
      x: right.x * height,
      y: right.y * height
    })
  }
  if (type === 'GRADIENT_ANGULAR') {
    return ellipticalGradientTransform(center, along(up, height / 2), along(right, width / 2))
  }
  return ellipticalGradientTransform(center, along(right, width / 2), {
    x: center.x - up.x * (height / 2),
    y: center.y - up.y * (height / 2)
  })
}

function gradientStops(paint: PenGradientPaint, ctx: VarContext): GradientStop[] {
  return (paint.colors ?? []).map((stop) => ({
    color: resolveColor(stop.color, ctx),
    position: resolveNumber(stop.position, ctx)
  }))
}

function convertPaint(
  paint: PenPaint,
  index: number,
  field: PaintField,
  ctx: VarContext,
  node: SceneNode | undefined,
  images: PenImages | undefined
): Fill | null {
  if (typeof paint === 'string' || paint.type === 'color') {
    const raw = typeof paint === 'string' ? paint : paint.color
    if (typeof raw !== 'string') return null
    const color = resolveColor(raw, ctx)
    if (node) bindIfVar(node, `${field}/${index}/color`, raw, ctx)
    return {
      type: 'SOLID',
      color,
      opacity: color.a,
      visible: typeof paint === 'string' || resolveBoolean(paint.enabled, ctx),
      blendMode: typeof paint === 'string' ? undefined : mapBlendMode(paint.blendMode)
    }
  }
  if (paint.type === 'gradient') {
    const gradient = paint as PenGradientPaint
    const type = GRADIENT_TYPES[gradient.gradientType ?? 'linear']
    if (!type) return null
    return {
      type,
      color: { ...TRANSPARENT },
      opacity: resolveNumber(gradient.opacity, ctx, 1),
      visible: resolveBoolean(gradient.enabled, ctx),
      blendMode: mapBlendMode(gradient.blendMode),
      gradientStops: gradientStops(gradient, ctx),
      gradientTransform: gradientTransform(gradient, type, ctx)
    }
  }
  if (paint.type === 'image') {
    const source = paint as PenImagePaint
    const image = source.url ? images?.get(source.url) : undefined
    if (!image) return null
    const box = { width: node?.width ?? 0, height: node?.height ?? 0 }
    return {
      ...imagePaint(source, image, box, resolveNumber(source.opacity, ctx, 1)),
      visible: resolveBoolean(source.enabled, ctx),
      blendMode: mapBlendMode(source.blendMode)
    }
  }
  return null
}

/** A node's fills, or its strokes' paints, in pen.dev's order: the last one draws on top. */
export function convertPaints(
  paints: PenPaints | undefined,
  field: PaintField,
  ctx: VarContext,
  node?: SceneNode,
  images?: PenImages
): Fill[] {
  if (paints === undefined) return []
  const list = Array.isArray(paints) ? paints : [paints]
  const result: Fill[] = []
  for (const paint of list) {
    const converted = convertPaint(paint, result.length, field, ctx, node, images)
    if (converted) result.push(converted)
  }
  return result
}

const ALIGNMENTS: Partial<Record<string, Stroke['align']>> = {
  inner: 'INSIDE',
  inside: 'INSIDE',
  center: 'CENTER',
  outer: 'OUTSIDE',
  outside: 'OUTSIDE'
}

const JOINS: Partial<Record<string, StrokeJoin>> = {
  miter: 'MITER',
  bevel: 'BEVEL',
  round: 'ROUND'
}
const CAPS: Partial<Record<string, StrokeCap>> = { butt: 'NONE', round: 'ROUND', square: 'SQUARE' }

/** The stroke fields of a node, with the 2.8 object form spread into the current ones. */
export interface PenStrokeFields {
  paints: PenPaints | undefined
  width: PenNode['strokeWidth']
  alignment: string | undefined
  cap: string | undefined
  join: string | undefined
}

function isLegacyStroke(stroke: PenNode['stroke']): stroke is PenLegacyStroke {
  return typeof stroke === 'object' && !Array.isArray(stroke) && 'thickness' in stroke
}

/** A node's stroke fields; an instance's own fields replace its component's one by one. */
export function strokeFields(pen: PenOverride, base?: PenStrokeFields): PenStrokeFields {
  if (isLegacyStroke(pen.stroke)) {
    return {
      paints: pen.stroke.fill,
      width: pen.stroke.thickness,
      alignment: pen.stroke.align,
      cap: pen.stroke.cap,
      join: pen.stroke.join
    }
  }
  return {
    paints: pen.stroke ?? base?.paints,
    width: pen.strokeWidth ?? base?.width,
    alignment: pen.strokeAlignment ?? base?.alignment,
    cap: pen.strokeLinecap ?? base?.cap,
    join: pen.strokeLinejoin ?? base?.join
  }
}

function sideWeights(sides: PenSides, ctx: VarContext) {
  return {
    top: resolveNumber(sides.top, ctx),
    right: resolveNumber(sides.right, ctx),
    bottom: resolveNumber(sides.bottom, ctx),
    left: resolveNumber(sides.left, ctx)
  }
}

/**
 * Sets a node's strokes. pen.dev draws a stroke only with both paints and a width: a missing side
 * of a per-side width is zero, and the alignment defaults to centred.
 */
export function applyStroke(
  node: SceneNode,
  fields: PenStrokeFields,
  ctx: VarContext,
  images?: PenImages
): void {
  node.strokes = []
  node.independentStrokeWeights = false
  if (fields.paints === undefined || fields.width === undefined) return

  let weight: number
  if (typeof fields.width === 'object') {
    const sides = sideWeights(fields.width, ctx)
    weight = Math.max(sides.top, sides.right, sides.bottom, sides.left)
    node.independentStrokeWeights = true
    node.borderTopWeight = sides.top
    node.borderRightWeight = sides.right
    node.borderBottomWeight = sides.bottom
    node.borderLeftWeight = sides.left
  } else {
    weight = resolveNumber(fields.width, ctx)
    bindIfVar(node, 'strokeWeight', fields.width, ctx)
  }
  if (weight <= 0) return

  const align = ALIGNMENTS[fields.alignment ?? 'center'] ?? 'CENTER'
  const cap = CAPS[fields.cap ?? 'butt'] ?? 'NONE'
  const join = JOINS[fields.join ?? 'miter'] ?? 'MITER'
  node.strokeCap = cap
  node.strokeJoin = join
  node.strokes = convertPaints(fields.paints, 'strokes', ctx, node, images).map((paint) => ({
    ...paint,
    weight,
    align,
    cap,
    join,
    dashPattern: []
  }))
}

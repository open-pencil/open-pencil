import type { Color, Vector } from './primitives'
import type { Fill, GradientStop, GradientTransform } from './types'

/**
 * Gradient paints in Figma's convention. A paint's `gradientTransform` maps the layer's unit
 * square to gradient space, as Figma's plugin API, `.fig` files, and the clipboard store it. In
 * gradient space a linear gradient runs from (0, 0.5) to (1, 0.5); radial, angular, and diamond
 * gradients are centred on (0.5, 0.5) with radius 0.5, and an angular one starts at +x and turns
 * clockwise. Every reader and writer of gradients goes through this module.
 */

export type GradientFillType = Extract<
  Fill['type'],
  'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'
>

export function isGradientFill(type: Fill['type']): type is GradientFillType {
  return (
    type === 'GRADIENT_LINEAR' ||
    type === 'GRADIENT_RADIAL' ||
    type === 'GRADIENT_ANGULAR' ||
    type === 'GRADIENT_DIAMOND'
  )
}

/** Left to right for a linear gradient; centred and filling the layer for the others. */
export const IDENTITY_GRADIENT_TRANSFORM: GradientTransform = {
  m00: 1,
  m01: 0,
  m02: 0,
  m10: 0,
  m11: 1,
  m12: 0
}

/**
 * Figma's transform when a fill becomes a gradient: top to bottom, and centred when switched to
 * another kind (Figma desktop 126).
 */
export const DEFAULT_GRADIENT_TRANSFORM: GradientTransform = {
  m00: 0,
  m01: 1,
  m02: 0,
  m10: -1,
  m11: 0,
  m12: 1
}

/** How dark a new gradient's second stop is next to the fill colour, as in Figma. */
const DEFAULT_GRADIENT_SHADE = 0.6

/** Figma's stops for a new gradient: the fill colour, then a 60% shade of it. */
export function defaultGradientStops(color: Color): GradientStop[] {
  return [
    { color: { ...color }, position: 0 },
    {
      color: {
        r: color.r * DEFAULT_GRADIENT_SHADE,
        g: color.g * DEFAULT_GRADIENT_SHADE,
        b: color.b * DEFAULT_GRADIENT_SHADE,
        a: color.a
      },
      position: 1
    }
  ]
}

export function isIdentityGradientTransform(t: GradientTransform): boolean {
  return (Object.keys(IDENTITY_GRADIENT_TRANSFORM) as (keyof GradientTransform)[]).every(
    (key) => t[key] === IDENTITY_GRADIENT_TRANSFORM[key]
  )
}

/**
 * The inverse affine map; a singular one falls back to the identity. Inverting a
 * `gradientTransform` gives the map from gradient space to the layer's unit square.
 */
export function invertGradientTransform(t: GradientTransform): GradientTransform {
  const det = t.m00 * t.m11 - t.m01 * t.m10
  if (Math.abs(det) < 1e-12) return IDENTITY_GRADIENT_TRANSFORM
  const m00 = t.m11 / det
  const m01 = -t.m01 / det
  const m10 = -t.m10 / det
  const m11 = t.m00 / det
  return {
    m00,
    m01,
    m02: -(m00 * t.m02 + m01 * t.m12),
    m10,
    m11,
    m12: -(m10 * t.m02 + m11 * t.m12)
  }
}

/** A point through an affine map. */
export function applyGradientTransform(t: GradientTransform, point: Vector): Vector {
  return {
    x: t.m00 * point.x + t.m01 * point.y + t.m02,
    y: t.m10 * point.x + t.m11 * point.y + t.m12
  }
}

/** Where a point of gradient space falls in the layer's unit square. */
export function gradientPoint(t: GradientTransform, point: Vector): Vector {
  return applyGradientTransform(invertGradientTransform(t), point)
}

/**
 * The transform of a linear gradient from `start` to `end` whose bands run along `across`, all in
 * the layer's unit square, such as an SVG gradient mapped through its own transform.
 */
export function linearGradientTransformFromAxes(
  start: Vector,
  end: Vector,
  across: Vector
): GradientTransform {
  return invertGradientTransform({
    m00: end.x - start.x,
    m01: across.x,
    m02: start.x - across.x / 2,
    m10: end.y - start.y,
    m11: across.y,
    m12: start.y - across.y / 2
  })
}

/**
 * The transform of a linear gradient from `start` to `end`, both in the layer's unit square, in a
 * `width` × `height` layer. Its second axis is square to the line on screen and `ratio` times as
 * long; Figma keeps that ratio when a handle is dragged (measured on desktop 126), and it starts
 * as the layer's height over its width.
 */
export function linearGradientTransform(
  start: Vector,
  end: Vector,
  width = 1,
  height = 1,
  ratio = height / width
): GradientTransform {
  const axis = { x: end.x - start.x, y: end.y - start.y }
  return linearGradientTransformFromAxes(start, end, {
    x: (-axis.y * height * ratio) / width,
    y: (axis.x * width * ratio) / height
  })
}

/**
 * The transform of a radial, angular, or diamond gradient from its centre and the ends of its two
 * radii, all in the layer's unit square.
 */
export function ellipticalGradientTransform(
  center: Vector,
  radiusX: Vector,
  radiusY: Vector
): GradientTransform {
  const xAxis = { x: 2 * (radiusX.x - center.x), y: 2 * (radiusX.y - center.y) }
  const yAxis = { x: 2 * (radiusY.x - center.x), y: 2 * (radiusY.y - center.y) }
  return invertGradientTransform({
    m00: xAxis.x,
    m01: yAxis.x,
    m02: center.x - (xAxis.x + yAxis.x) / 2,
    m10: xAxis.y,
    m11: yAxis.y,
    m12: center.y - (xAxis.y + yAxis.y) / 2
  })
}

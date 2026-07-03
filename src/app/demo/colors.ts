import { BLACK } from '@open-pencil/core/constants'
import type { Color, Fill, GradientStop, Stroke } from '@open-pencil/scene-graph'

export const DEMO_COLORS = {
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: BLACK,
  gray50: { r: 0.98, g: 0.98, b: 0.98, a: 1 },
  gray100: { r: 0.96, g: 0.96, b: 0.97, a: 1 },
  gray200: { r: 0.9, g: 0.9, b: 0.92, a: 1 },
  gray500: { r: 0.55, g: 0.55, b: 0.58, a: 1 },
  blue: { r: 0.23, g: 0.51, b: 0.96, a: 1 },
  indigo: { r: 0.38, g: 0.35, b: 0.95, a: 1 },
  purple: { r: 0.59, g: 0.28, b: 0.96, a: 1 },
  green: { r: 0.13, g: 0.77, b: 0.42, a: 1 },
  orange: { r: 0.96, g: 0.52, b: 0.13, a: 1 },
  red: { r: 0.91, g: 0.22, b: 0.22, a: 1 },
  teal: { r: 0.08, g: 0.73, b: 0.73, a: 1 }
} satisfies Record<string, Color>

export function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

export function gradient(stops: GradientStop[]): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    color: stops[0].color,
    opacity: 1,
    visible: true,
    gradientStops: stops,
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
}

export function thinStroke(color: Color): Stroke[] {
  return [{ color, weight: 1, opacity: 1, visible: true, align: 'INSIDE' as const }]
}

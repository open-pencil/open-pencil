import { BLACK } from '@open-pencil/core/constants'
import type { Color, Fill, GradientStop, Stroke } from '@open-pencil/scene-graph'

/** A single restrained product palette — modern, not a rainbow. */
export const DEMO_COLORS = {
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: BLACK,
  // surfaces
  bg: { r: 0.97, g: 0.97, b: 0.98, a: 1 },
  surface: { r: 1, g: 1, b: 1, a: 1 },
  surfaceSunken: { r: 0.96, g: 0.96, b: 0.98, a: 1 },
  // text
  textPrimary: { r: 0.09, g: 0.09, b: 0.11, a: 1 },
  textSecondary: { r: 0.45, g: 0.46, b: 0.5, a: 1 },
  textTertiary: { r: 0.66, g: 0.67, b: 0.71, a: 1 },
  // border
  border: { r: 0.9, g: 0.9, b: 0.93, a: 1 },
  borderStrong: { r: 0.84, g: 0.84, b: 0.88, a: 1 },
  // one accent + supporting semantics
  accent: { r: 0.36, g: 0.4, b: 0.96, a: 1 },
  accentSoft: { r: 0.93, g: 0.93, b: 1, a: 1 },
  accentText: { r: 0.28, g: 0.32, b: 0.9, a: 1 },
  success: { r: 0.13, g: 0.72, b: 0.42, a: 1 },
  successSoft: { r: 0.9, g: 0.98, b: 0.93, a: 1 },
  danger: { r: 0.92, g: 0.26, b: 0.28, a: 1 },
  dangerSoft: { r: 1, g: 0.93, b: 0.93, a: 1 },
  warning: { r: 0.96, g: 0.62, b: 0.1, a: 1 },
  warningSoft: { r: 1, g: 0.96, b: 0.88, a: 1 }
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

export function noStroke(): Stroke[] {
  return []
}

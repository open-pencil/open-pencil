import type { Color, Fill, GradientStop, Stroke } from '@open-pencil/core/scene-graph'

export const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
export const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
export const GRAY_50: Color = { r: 0.98, g: 0.98, b: 0.98, a: 1 }
export const GRAY_100: Color = { r: 0.96, g: 0.96, b: 0.97, a: 1 }
export const GRAY_200: Color = { r: 0.9, g: 0.9, b: 0.92, a: 1 }
export const GRAY_500: Color = { r: 0.55, g: 0.55, b: 0.58, a: 1 }
export const BLUE: Color = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
export const INDIGO: Color = { r: 0.38, g: 0.35, b: 0.95, a: 1 }
export const PURPLE: Color = { r: 0.59, g: 0.28, b: 0.96, a: 1 }
export const GREEN: Color = { r: 0.13, g: 0.77, b: 0.42, a: 1 }
export const ORANGE: Color = { r: 0.96, g: 0.52, b: 0.13, a: 1 }
export const RED: Color = { r: 0.91, g: 0.22, b: 0.22, a: 1 }
export const TEAL: Color = { r: 0.08, g: 0.73, b: 0.73, a: 1 }

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

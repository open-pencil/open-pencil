import * as v from 'valibot'

import type { CubicBezier, Easing, EasingCurve } from '@open-pencil/scene-graph'
import {
  cubicBezierSchema,
  easingBezier,
  easingPreset,
  easingSpring,
  springBounce,
  springWithBounce
} from '@open-pencil/scene-graph/variables'

/** The curve or spring each of the plugin API's easing types stores. */
const CURVES = {
  EASE_IN: 'EASE_IN',
  EASE_OUT: 'OUT_CUBIC',
  EASE_IN_AND_OUT: 'INOUT_CUBIC',
  LINEAR: 'LINEAR',
  EASE_IN_BACK: 'IN_BACK_CUBIC',
  EASE_OUT_BACK: 'OUT_BACK_CUBIC',
  EASE_IN_AND_OUT_BACK: 'INOUT_BACK_CUBIC',
  CUSTOM_CUBIC_BEZIER: 'CUSTOM_CUBIC',
  GENTLE: 'GENTLE_SPRING',
  QUICK: 'SPRING_PRESET_ONE',
  BOUNCY: 'SPRING_PRESET_TWO',
  SLOW: 'SPRING_PRESET_THREE',
  CUSTOM_SPRING: 'CUSTOM_SPRING',
  HOLD: 'HOLD'
} as const satisfies Record<string, EasingCurve>

export type FigmaEasingType = keyof typeof CURVES

export function isFigmaEasingType(name: string): name is FigmaEasingType {
  return Object.hasOwn(CURVES, name)
}

/** An easing as Figma's plugin API reads and writes it. */
export interface FigmaEasing {
  type: FigmaEasingType
  easingFunctionCubicBezier?: CubicBezier
  easingFunctionSpring?: { bounce: number }
}

const TYPES = Object.fromEntries(
  Object.entries(CURVES).map(([type, curve]) => [curve, type as FigmaEasingType])
) as Partial<Record<EasingCurve, FigmaEasingType>>

/**
 * A curve the API has no name for reads as the custom one of its kind: a new variable's
 * `IN_CUBIC`, which Figma reads back as a custom curve, and a spring saved as `SPRING`.
 */
function figmaEasingType(easing: Easing): FigmaEasingType {
  return TYPES[easing.easing] ?? (easingSpring(easing) ? 'CUSTOM_SPRING' : 'CUSTOM_CUBIC_BEZIER')
}

/** The curve the plugin API reads a new variable's `IN_CUBIC` back as, though Figma draws Ease in. */
const NEW_VARIABLE_CURVE: CubicBezier = { x1: 0.5, y1: 0, x2: 0.5, y2: 1 }

/** An easing as the plugin API reads it: a preset's own numbers, a custom one's, a spring's bounce. */
export function figmaEasing(easing: Easing): FigmaEasing {
  if (easing.easing === 'IN_CUBIC')
    return {
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: { ...(easing.bezier ?? NEW_VARIABLE_CURVE) }
    }
  const type = figmaEasingType(easing)
  const spring = easingSpring(easing)
  if (spring) return { type, easingFunctionSpring: { bounce: springBounce(spring) } }
  const preset = type === 'CUSTOM_CUBIC_BEZIER' ? easing : { easing: CURVES[type] }
  const bezier = easingBezier(preset)
  return bezier ? { type, easingFunctionCubicBezier: { ...bezier } } : { type }
}

const figmaEasingSchema = v.object({
  type: v.picklist(Object.keys(CURVES) as FigmaEasingType[]),
  easingFunctionCubicBezier: v.optional(cubicBezierSchema),
  easingFunctionSpring: v.optional(
    v.object({ bounce: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) })
  )
})

/**
 * The easing `setValueForMode` stores for the API's value, or nothing for a value that is not
 * one. A preset stores its own numbers; a custom spring, the spring with its bounce.
 */
export function storedEasing(value: unknown): Easing | undefined {
  const parsed = v.safeParse(figmaEasingSchema, value)
  if (!parsed.success) return undefined
  const { type, easingFunctionCubicBezier: bezier, easingFunctionSpring: spring } = parsed.output
  if (type === 'CUSTOM_CUBIC_BEZIER' && bezier) return { easing: 'CUSTOM_CUBIC', bezier }
  if (type === 'CUSTOM_SPRING')
    return { easing: 'CUSTOM_SPRING', spring: springWithBounce(spring?.bounce ?? 0) }
  return easingPreset(CURVES[type])
}

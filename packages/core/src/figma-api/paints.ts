import type { Fill, GradientTransform } from '@open-pencil/scene-graph'
import {
  gradientTransformRows,
  IDENTITY_GRADIENT_TRANSFORM
} from '@open-pencil/scene-graph/gradient'

import type { FigmaTransform } from './types'

/** The transforms a paint carries: gradients map the layer onto gradient space, images crop. */
const TRANSFORM_FIELDS = ['gradientTransform', 'imageTransform'] as const

type TransformField = (typeof TRANSFORM_FIELDS)[number]

/** A paint as Figma's plugin API gives and takes it, its transforms as two rows of three. */
export type WithFigmaTransforms<T> = Omit<T, TransformField> & {
  gradientTransform?: FigmaTransform
  imageTransform?: FigmaTransform
}

function isRow(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

/** Figma's complaint about `value` as a transform, or null when it is two rows of three numbers. */
function transformProblem(value: unknown): string | null {
  if (value === undefined) return 'Required value missing'
  if (!Array.isArray(value))
    return `Expected array, received ${value === null ? 'null' : typeof value}`
  if (value.length < 2) return 'Too small: expected array to have exactly 2 items'
  if (value.length > 2) return 'Too big: expected array to have exactly 2 items'
  return value.every(isRow) ? null : 'Expected array of 3 numbers'
}

/** Whether Figma requires `field` on a paint of `type`, as it does a gradient's transform. */
function requires(type: Fill['type'], field: TransformField): boolean {
  return field === 'gradientTransform' && type.startsWith('GRADIENT_')
}

/**
 * The scene transforms of a paint a script passes to `method`, at `index` in `property`. Figma
 * takes only two rows of three numbers and throws the way its `fills` and `strokes` setters do.
 */
export function sceneTransforms(
  paint: { type: Fill['type'] } & Partial<Record<TransformField, unknown>>,
  index: number,
  method = 'set_fills',
  property = 'fills'
): Partial<Record<TransformField, GradientTransform>> {
  const transforms: Partial<Record<TransformField, GradientTransform>> = {}
  for (const field of TRANSFORM_FIELDS) {
    const value = paint[field]
    if (value === undefined && !requires(paint.type, field)) continue
    const problem = transformProblem(value)
    if (problem) {
      const at = `[${index}].${field}`
      throw new Error(
        `in ${method}: Property "${property}" failed validation: Expected ${at} to be one of ` +
          `the following, but none matched:\n  ${problem} at ${at}`
      )
    }
    const [[m00, m01, m02], [m10, m11, m12]] = value as FigmaTransform
    transforms[field] = { m00, m01, m02, m10, m11, m12 }
  }
  return transforms
}

/**
 * `paint` with its transforms as Figma gives them: two rows of three. An image paint reports the
 * identity when it has none, as Figma's do outside crop mode.
 */
export function toFigmaPaint<T extends Fill>(paint: T): WithFigmaTransforms<T> {
  const { gradientTransform, imageTransform, ...rest } = paint
  const image = imageTransform ?? (paint.type === 'IMAGE' ? IDENTITY_GRADIENT_TRANSFORM : undefined)
  return {
    ...rest,
    ...(gradientTransform && { gradientTransform: gradientTransformRows(gradientTransform) }),
    ...(image && { imageTransform: gradientTransformRows(image) })
  }
}

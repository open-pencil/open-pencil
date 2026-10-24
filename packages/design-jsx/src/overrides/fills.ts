import * as v from 'valibot'

import type { Fill, GradientTransform } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'
import { paintTransformSchema } from '@open-pencil/scene-graph/paints'
import type { Color } from '@open-pencil/scene-graph/primitives'

export function isColor(value: unknown): value is Color {
  return (
    value !== null &&
    typeof value === 'object' &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  )
}

function isFill(value: unknown): value is Fill {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'color' in value &&
    'visible' in value
  )
}

/** A paint as props write it: a colour string, a colour, or a paint from a helper. */
export function isFillValue(value: unknown): value is string | Color | Fill {
  return typeof value === 'string' || isColor(value) || isFill(value)
}

const TRANSFORM_FIELDS = ['gradientTransform', 'imageTransform'] as const

/** Worded as `parseScriptInput` words it; that lives in `schema.ts`, which imports this module. */
function parseTransform(
  field: (typeof TRANSFORM_FIELDS)[number],
  value: unknown
): GradientTransform {
  const result = v.safeParse(paintTransformSchema, value)
  if (result.success) return result.output
  throw new Error(
    `A paint's ${field} expects Figma's [[a, b, c], [d, e, f]] or { m00, m01, m02, m10, m11, m12 }:\n${v.summarize(result.issues)}`
  )
}

export function fillFromValue(value: string | Color | Fill): Fill {
  if (!isFill(value)) return colorToFill(value)
  const fill = structuredClone(value)
  // A paint written as an object, as export writes an image, gives its transforms as Figma's rows.
  for (const field of TRANSFORM_FIELDS) {
    if (fill[field] !== undefined) fill[field] = parseTransform(field, fill[field])
  }
  return fill
}

import * as v from 'valibot'

// Values Figma's plugin API takes in several places, as its schemas check them.

/** A finite number, as Figma takes every number. */
export const finiteNumberSchema = v.pipe(v.number(), v.finite())

/** A finite number from `minimum` up. */
export function atLeast(minimum: number) {
  return v.pipe(v.number(), v.finite(), v.minValue(minimum))
}

/** A number from 0 to 1, as Figma takes colour channels, opacity, and ratios. */
export const unitIntervalSchema = v.pipe(finiteNumberSchema, v.minValue(0), v.maxValue(1))

/** Figma's `FontNameInput`: a family, and a style and axes that may be left out. */
export const fontNameSchema = v.strictObject({
  family: v.string(),
  style: v.optional(v.string()),
  variationSettings: v.optional(v.record(v.string(), finiteNumberSchema))
})

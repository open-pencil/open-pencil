import * as v from 'valibot'

import { parseFigma } from '#core/figma-api/validation'

// Values Figma's plugin API takes in several places, as its schemas check them.

/** A finite number, as Figma takes every number. */
export const finiteNumberSchema = v.pipe(v.number(), v.finite())

/** A setter's number, refused as Figma refuses it when it is not finite. */
export function finiteNumber(value: unknown, property: string, method = `set_${property}`): number {
  return parseFigma(finiteNumberSchema, value, method, property)
}

/** A row of Figma's `Transform`: three numbers, in an array or an object keyed 0 to 2. */
const transformRowSchema = v.union([
  v.pipe(v.array(finiteNumberSchema), v.length(3)),
  v.strictObject({ 0: finiteNumberSchema, 1: finiteNumberSchema, 2: finiteNumberSchema })
])

/** Figma's `Transform`: two rows, in an array or an object keyed 0 and 1. */
export const transformSchema = v.union([
  v.pipe(v.array(transformRowSchema), v.length(2)),
  v.strictObject({ 0: transformRowSchema, 1: transformRowSchema })
])

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

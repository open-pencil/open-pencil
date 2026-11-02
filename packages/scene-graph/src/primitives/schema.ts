import * as v from 'valibot'

export const finiteNumberSchema = v.pipe(v.number(), v.finite())

export const vectorSchema = v.object({ x: finiteNumberSchema, y: finiteNumberSchema })

export const matrixSchema = v.object({
  m00: finiteNumberSchema,
  m01: finiteNumberSchema,
  m02: finiteNumberSchema,
  m10: finiteNumberSchema,
  m11: finiteNumberSchema,
  m12: finiteNumberSchema
})

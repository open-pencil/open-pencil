import * as v from 'valibot'

import { colorSchema } from '../color/schema'
import { finiteNumberSchema } from '../primitives/schema'
import { EASING_CURVES } from '../types'

export const variableAliasSchema = v.object({ aliasId: v.string() })
export const variableColorExpressionSchema = v.object({
  expression: v.literal('COMPOSE_COLOR'),
  color: v.union([variableAliasSchema, colorSchema]),
  opacity: v.union([variableAliasSchema, finiteNumberSchema])
})

/**
 * A variable or collection as data from outside the process can hold it: the fields every
 * reader relies on are checked, and the rest pass through as they are.
 */
export const variableSchema = v.looseObject({
  id: v.string(),
  name: v.string(),
  type: v.string(),
  collectionId: v.string(),
  valuesByMode: v.record(v.string(), v.unknown())
})

export const variableCollectionSchema = v.looseObject({
  id: v.string(),
  name: v.string(),
  defaultModeId: v.string(),
  modes: v.array(v.unknown()),
  variableIds: v.array(v.unknown())
})

export const cubicBezierSchema = v.object({
  x1: finiteNumberSchema,
  y1: finiteNumberSchema,
  x2: finiteNumberSchema,
  y2: finiteNumberSchema
})

const positiveSchema = v.pipe(finiteNumberSchema, v.minValue(0))

export const springSchema = v.object({
  stiffness: positiveSchema,
  damping: positiveSchema,
  mass: positiveSchema,
  type: v.optional(v.picklist(['NORMALIZED', 'PHYSICAL'])),
  platform: v.optional(v.picklist(['IOS_WEB', 'ANDROID']))
})

export const easingSchema = v.object({
  easing: v.picklist(EASING_CURVES),
  bezier: v.optional(cubicBezierSchema),
  spring: v.optional(springSchema)
})

import * as v from 'valibot'

import { colorSchema } from '../color/schema'
import { finiteNumberSchema } from '../primitives/schema'

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

import * as v from 'valibot'

export const variableAliasSchema = v.object({ aliasId: v.string() })
const finiteNumber = v.pipe(v.number(), v.finite())

export const variableColorExpressionSchema = v.object({
  expression: v.literal('COMPOSE_COLOR'),
  color: v.union([
    variableAliasSchema,
    v.object({ r: finiteNumber, g: finiteNumber, b: finiteNumber, a: finiteNumber })
  ]),
  opacity: v.union([variableAliasSchema, finiteNumber])
})

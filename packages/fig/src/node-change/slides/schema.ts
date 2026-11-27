import * as v from 'valibot'

export const guidSchema = v.object({ sessionID: v.number(), localID: v.number() })

/** A record's reference to a variable; only an alias names one. */
export const variableDataSchema = v.looseObject({
  dataType: v.optional(v.string()),
  value: v.optional(
    v.looseObject({ alias: v.optional(v.looseObject({ guid: v.optional(guidSchema) })) })
  )
})

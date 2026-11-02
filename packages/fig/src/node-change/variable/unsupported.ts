import * as v from 'valibot'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { VariableDataEntry } from '@open-pencil/kiwi/fig/codec'

const guidSchema = v.looseObject({
  sessionID: v.pipe(v.number(), v.integer(), v.minValue(0)),
  localID: v.pipe(v.number(), v.integer(), v.minValue(0))
})
const referenceSchema = v.looseObject({
  guid: v.optional(guidSchema),
  assetRef: v.optional(v.looseObject({ key: v.string(), version: v.optional(v.string()) }))
})
const dataSchema: v.GenericSchema<VariableDataEntry> = v.lazy(() =>
  v.looseObject({
    dataType: v.optional(v.string()),
    resolvedDataType: v.optional(v.string()),
    value: v.optional(
      v.looseObject({
        alias: v.optional(referenceSchema),
        mapValue: v.optional(
          v.looseObject({
            values: v.optional(
              v.array(
                v.looseObject({
                  key: v.optional(v.string()),
                  guidKey: v.optional(guidSchema),
                  value: v.optional(dataSchema)
                })
              )
            )
          })
        ),
        colorArrayValue: v.optional(v.looseObject({ colors: v.optional(v.array(dataSchema)) })),
        fontStyleValue: v.optional(
          v.looseObject({
            asString: v.optional(dataSchema),
            asFloat: v.optional(dataSchema),
            asVariations: v.optional(dataSchema)
          })
        ),
        boolValue: v.optional(v.boolean()),
        floatValue: v.optional(v.number()),
        textValue: v.optional(v.string()),
        colorValue: v.optional(
          v.looseObject({ r: v.number(), g: v.number(), b: v.number(), a: v.number() })
        ),
        expressionValue: v.optional(
          v.looseObject({
            expressionFunction: v.string(),
            expressionArguments: v.optional(v.array(dataSchema))
          })
        )
      })
    )
  })
)
type Alias = NonNullable<NonNullable<VariableDataEntry['value']>['alias']>

/**
 * Walk the aliases and mode keys of an expression OpenPencil does not evaluate, always in the same
 * order, without reading the function. `alias` gets each alias with its position and may return a
 * replacement; `mode` does the same for each mode key. Changes `entry` in place.
 */
export function mapUnsupportedExpressionReferences(
  entry: VariableDataEntry,
  alias: (reference: Alias, index: number) => Alias | undefined,
  mode: (guid: GUID, index: number) => GUID = (guid) => guid
): void {
  let index = 0
  let modeIndex = 0
  const visit = (data: VariableDataEntry): void => {
    const value = data.value
    if (!value) return
    if (value.alias) value.alias = alias(value.alias, index++) ?? value.alias
    const nested = [
      ...(value.expressionValue?.expressionArguments ?? []),
      ...(value.colorArrayValue?.colors ?? []),
      value.fontStyleValue?.asString,
      value.fontStyleValue?.asFloat,
      value.fontStyleValue?.asVariations
    ]
    for (const item of value.mapValue?.values ?? []) {
      if (item.guidKey) item.guidKey = mode(item.guidKey, modeIndex++)
      nested.push(item.value)
    }
    for (const child of nested) if (child) visit(child)
  }
  visit(entry)
}

/** Check a kept expression, which may have come back through the clipboard, before writing it. */
export function unsupportedExpressionData(raw: unknown): VariableDataEntry {
  const parsed = v.parse(dataSchema, structuredClone(raw))
  if (parsed.dataType !== 'EXPRESSION' || !parsed.value?.expressionValue)
    throw new Error('Invalid unsupported variable expression')
  return parsed
}

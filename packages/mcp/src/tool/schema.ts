import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'
// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toJsonSchema as toJSONSchema } from '@valibot/to-json-schema'
import type * as v from 'valibot'

import { toolNumberSchema } from '@open-pencil/core/tools'

type ConversionConfig = NonNullable<Parameters<typeof toJSONSchema>[1]>
type Target = NonNullable<ConversionConfig['target']>
type ToolInputSchema<T extends v.GenericSchema> = StandardSchemaWithJSON<
  v.InferInput<T>,
  v.InferOutput<T>
>

const TARGETS: readonly string[] = ['draft-07', 'draft-2020-12', 'openapi-3.0'] satisfies Target[]

function isTarget(target: string): target is Target {
  return TARGETS.includes(target)
}

function conversionTarget(target: string): Target {
  if (!isTarget(target)) throw new Error(`Unsupported JSON Schema target: ${target}`)
  return target
}

/**
 * Leaves out what costs space without telling a client anything: the dialect URL, the bounds that
 * only say a number is finite, numeric strings beside numbers, and the closed-object flag. Some
 * clients load tools only up to a total schema size, so every tool's bytes count. Calls are still
 * checked against the whole Valibot input.
 */
function compactConfig(target: Target, typeMode: 'input' | 'output'): ConversionConfig {
  const config: ConversionConfig = {
    target,
    typeMode,
    overrideSchema({ valibotSchema, jsonSchema }) {
      const number = toolNumberSchema(valibotSchema)
      if (number) {
        const { $schema: _dialect, ...numberSchema } = toJSONSchema(number, config)
        return numberSchema
      }
      if (valibotSchema.type === 'strict_object' && jsonSchema.additionalProperties === false) {
        const { additionalProperties: _closed, ...open } = jsonSchema
        return open
      }
      return undefined
    },
    overrideAction({ valibotAction, jsonSchema }) {
      const { minimum, maximum, ...rest } = jsonSchema
      if (valibotAction.type === 'max_value' && maximum === Number.MAX_VALUE) {
        return minimum === undefined ? rest : { ...rest, minimum }
      }
      if (valibotAction.type === 'min_value' && minimum === -Number.MAX_VALUE) {
        return maximum === undefined ? rest : { ...rest, maximum }
      }
      return undefined
    }
  }
  return config
}

function compactJSONSchema(
  schema: v.GenericSchema,
  target: string,
  typeMode: 'input' | 'output'
): Record<string, unknown> {
  const { $schema: _dialect, ...json } = toJSONSchema(
    schema,
    compactConfig(conversionTarget(target), typeMode)
  )
  return json
}

/** A tool's input as MCP clients read it, described in as few bytes as it can be. */
export function toolInputSchema<T extends v.GenericSchema>(schema: T): ToolInputSchema<T> {
  return {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: {
        input: (options) => compactJSONSchema(schema, options.target, 'input'),
        output: (options) => compactJSONSchema(schema, options.target, 'output')
      }
    }
  }
}

import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { omitBy } from 'es-toolkit/object'
import type * as v from 'valibot'

import {
  jsonSchemaTarget,
  toolJSONSchema,
  toolNumberSchema,
  type JSONSchemaTarget
} from '@open-pencil/core/tools'

type ConversionConfig = NonNullable<Parameters<typeof toolJSONSchema>[1]>
type ToolInputSchema<T extends v.GenericSchema> = StandardSchemaWithJSON<
  v.InferInput<T>,
  v.InferOutput<T>
>

/**
 * Leaves out what costs space without telling a client anything: numeric strings beside numbers,
 * the closed-object flag, and empty required lists. Some clients load tools only up to a total
 * schema size, so every tool's bytes count. Calls are still checked against the whole Valibot
 * input.
 */
function compactConfig(target: JSONSchemaTarget, typeMode: 'input' | 'output'): ConversionConfig {
  const config: ConversionConfig = {
    target,
    typeMode,
    overrideSchema({ valibotSchema, jsonSchema }) {
      const number = toolNumberSchema(valibotSchema)
      if (number) {
        const { $schema: _dialect, ...numberSchema } = toolJSONSchema(number, config)
        return numberSchema
      }
      if (valibotSchema.type === 'strict_object' || valibotSchema.type === 'object') {
        // A closed object and an empty required list say nothing a client acts on.
        return omitBy(
          jsonSchema,
          (value, key) =>
            (key === 'additionalProperties' && value === false) ||
            (key === 'required' && Array.isArray(value) && value.length === 0)
        )
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
  // The dialect URL is the one part of the result a client never needs.
  const { $schema: _dialect, ...json } = toolJSONSchema(
    schema,
    compactConfig(jsonSchemaTarget(target), typeMode)
  )
  return json
}

/**
 * A tool's input as MCP clients read it, described in as few bytes as it can be. Calls are
 * checked against `schema`; `advertised` describes less of it when a client need not see all.
 */
export function toolInputSchema<T extends v.GenericSchema>(
  schema: T,
  advertised: v.GenericSchema = schema
): ToolInputSchema<T> {
  return {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: {
        input: (options) => compactJSONSchema(advertised, options.target, 'input'),
        output: (options) => compactJSONSchema(advertised, options.target, 'output')
      }
    }
  }
}

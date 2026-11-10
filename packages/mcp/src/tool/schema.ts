import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'
// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toJsonSchema as toJSONSchema } from '@valibot/to-json-schema'
import { mapValues, omitBy } from 'es-toolkit/object'
import { isPlainObject } from 'es-toolkit/predicate'
import { escapeRegExp } from 'es-toolkit/string'
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
 * only say a number is finite, numeric strings beside numbers, the closed-object flag, and empty
 * required lists. Some
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

/** "(default: x)" in a description, which a `default` of x already says. */
function withoutRepeatedDefault(description: string, value: unknown): string {
  if (typeof value === 'object' && value !== null) return description
  const repeat = new RegExp(`\\s*\\(default:? ${escapeRegExp(String(value))}\\)`, 'i')
  return description.replace(repeat, '')
}

/** The schema with each description's repeat of its `default` left out. */
function stripRepeatedDefaults(schema: Record<string, unknown>): Record<string, unknown> {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip)
    return isPlainObject(value) ? stripRepeatedDefaults(value) : value
  }
  const stripped = mapValues(schema, strip)
  if (typeof stripped.description === 'string' && 'default' in stripped)
    stripped.description = withoutRepeatedDefault(stripped.description, stripped.default)
  return stripped
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
  return stripRepeatedDefaults(json)
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

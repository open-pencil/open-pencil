import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  fromJsonSchema as fromJSONSchema,
  type StandardSchemaWithJSON
} from '@modelcontextprotocol/server'
import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  toStandardJsonSchema as toStandardJSONSchema
} from '@valibot/to-json-schema'
import type * as v from 'valibot'

/** A tool's Valibot input as an MCP server takes it: checked by Valibot, described as JSON Schema. */
export function toolInput<T extends v.GenericSchema>(
  schema: T
): StandardSchemaWithJSON<v.InferInput<T>, v.InferOutput<T>> {
  return {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: toStandardJSONSchema(schema)['~standard'].jsonSchema
    }
  }
}

const compiled = new Map<string, StandardSchemaWithJSON<Record<string, unknown>>>()

/**
 * A tool input given as JSON Schema, checked by the MCP SDK's validator for the runtime. Each is
 * compiled once per process, since the endpoint builds its server for every request.
 */
export function jsonToolInput(
  name: string,
  schema: Record<string, unknown>
): StandardSchemaWithJSON<Record<string, unknown>> {
  let input = compiled.get(name)
  if (!input) {
    input = fromJSONSchema<Record<string, unknown>>(schema)
    compiled.set(name, input)
  }
  return input
}

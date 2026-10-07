import * as v from 'valibot'

/**
 * Parse a value a design JSX script passed, or throw `heading` followed by every problem and
 * where it is, as `v.summarize` lists them. Core words tool arguments the same way.
 */
export function parseScriptInput<S extends v.GenericSchema>(
  heading: string,
  schema: S,
  value: unknown
): v.InferOutput<S> {
  const result = v.safeParse(schema, value)
  if (result.success) return result.output
  throw new Error(`${heading}:\n${v.summarize(result.issues)}`)
}

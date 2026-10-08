import * as v from 'valibot'

const jsonObjectSchema = v.record(v.string(), v.unknown())

export function parseJSON(text: string, context: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${context}: invalid JSON`)
  }
}

export function parseJSONObject(
  text: string,
  context: string
): v.InferOutput<typeof jsonObjectSchema> {
  const parsed = v.safeParse(jsonObjectSchema, parseJSON(text, context))
  if (!parsed.success) throw new Error(`${context}: expected an object`)
  return parsed.output
}

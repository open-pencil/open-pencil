import type { Context } from 'hono'
import { validator } from 'hono/validator'
import { ValiError } from 'valibot'

/** A request part that fails its schema is a 400, never a server error. */
function parseOrReject<T>(parse: (input: unknown) => T, value: unknown, context: Context) {
  try {
    return parse(value)
  } catch (error) {
    if (error instanceof ValiError) {
      return context.json({ error: { code: 'invalid_request' as const } }, 400)
    }
    throw error
  }
}

export function validatedJSON<T>(parse: (input: unknown) => T) {
  return validator('json', (value, context: Context) => parseOrReject(parse, value, context))
}

/** Query string counterpart of `validatedJSON`. */
export function validatedQuery<T>(parse: (input: unknown) => T) {
  return validator('query', (value, context: Context) => parseOrReject(parse, value, context))
}

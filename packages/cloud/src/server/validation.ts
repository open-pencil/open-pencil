import type { Context, MiddlewareHandler } from 'hono'
import { validator } from 'hono/validator'
import * as v from 'valibot'

/** A request part that fails its schema is a 400, never a server error. */
function parseOrReject<T>(parse: (input: unknown) => T, value: unknown, context: Context) {
  try {
    return parse(value)
  } catch (error) {
    if (error instanceof v.ValiError) {
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

const uuidSchema = v.pipe(v.string(), v.uuid())

/**
 * Answers 404 when a route parameter that names a row by UUID is not one: it names nothing, and
 * the database would refuse it as a server error. Mount it on the paths that declare the parameter.
 */
export function uuidParameter(name: string): MiddlewareHandler {
  return async (context, next) => {
    if (v.is(uuidSchema, context.req.param(name))) return next()
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
}

import type { FeedbackBindings, FeedbackEnv } from '#feedback/env'
import { createMiddleware } from 'hono/factory'
import { validator } from 'hono/validator'
import * as v from 'valibot'

/**
 * The JSON body parsed with `schema`, as Cloud validates its routes; a body that is not JSON or
 * has the wrong shape gets a 400 before the handler runs.
 */
export function validatedJSON<TSchema extends v.GenericSchema>(schema: TSchema) {
  return validator('json', (value, c) => {
    const parsed = v.safeParse(schema, value)
    return parsed.success ? parsed.output : c.body(null, 400)
  })
}

/** The query string parsed with `schema`; a missing or malformed parameter gets a 400. */
export function validatedQuery<TSchema extends v.GenericSchema>(schema: TSchema) {
  return validator('query', (value, c) => {
    const parsed = v.safeParse(schema, value)
    return parsed.success ? parsed.output : c.body(null, 400)
  })
}

/**
 * Counts the request against a rate limit, keyed by the client address Cloudflare reports. The
 * address lives only in the limiter's memory; nothing here stores or forwards it.
 */
export function rateLimited(limiter: (env: FeedbackBindings) => FeedbackBindings['PING_LIMITER']) {
  return createMiddleware<FeedbackEnv>(async (c, next) => {
    const key = c.req.header('cf-connecting-ip') ?? 'unknown'
    const { success } = await limiter(c.env).limit({ key })
    if (!success) return c.body(null, 429)
    return next()
  })
}

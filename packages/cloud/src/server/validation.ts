import { uuidParamSchema } from '#cloud/contract'
import { sValidator } from '@hono/standard-validator'
import * as v from 'valibot'

const invalidRequest = { error: { code: 'invalid_request' as const } }

/**
 * A JSON body through `schema`; handlers read it from `context.req.valid('json')`. A body that
 * fails it is a 400, never a server error. The route's type takes what the schema accepts and
 * hands handlers what it outputs, so a typed client may leave out a field with a default.
 */
export function validatedJSON<Schema extends v.GenericSchema>(schema: Schema) {
  return sValidator('json', schema, (result, context) =>
    result.success ? undefined : context.json(invalidRequest, 400)
  )
}

/** Query string counterpart of `validatedJSON`. */
export function validatedQuery<Schema extends v.GenericSchema>(schema: Schema) {
  return sValidator('query', schema, (result, context) =>
    result.success ? undefined : context.json(invalidRequest, 400)
  )
}

/**
 * Route parameters through `schema`; handlers read them from `context.req.valid('param')`. A
 * parameter that fails it names nothing, so the route answers 404 as for a missing row, and the
 * value never reaches the database.
 */
export function validatedParams<Schema extends v.GenericSchema>(schema: Schema) {
  return sValidator('param', schema, (result, context) =>
    result.success ? undefined : context.json({ error: { code: 'not_found' as const } }, 404)
  )
}

/** A route parameter the server takes as text, such as a user ID, which is not a UUID column. */
const textParamSchema = v.pipe(v.string(), v.minLength(1))

export const documentParams = validatedParams(v.object({ documentId: uuidParamSchema }))
/** A document and one of its revisions, as a thumbnail's address names them. */
export const documentRevisionParams = validatedParams(
  v.object({ documentId: uuidParamSchema, revisionId: uuidParamSchema })
)
/** A picture's address names its owner and a prefix of its checksum, which the service checks. */
export const pictureParams = validatedParams(
  v.object({ userId: textParamSchema, version: textParamSchema })
)

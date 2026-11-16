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
 * A route parameter that names a row by UUID, in lowercase: the database matches any case, but an
 * ID that also names something else, such as a document's relay, must have one spelling.
 */
const uuidParamSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase())

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
export const documentVersionParams = validatedParams(
  v.object({ documentId: uuidParamSchema, versionId: uuidParamSchema })
)
export const documentShareParams = validatedParams(
  v.object({ documentId: uuidParamSchema, shareId: uuidParamSchema })
)
export const documentInvitationParams = validatedParams(
  v.object({ documentId: uuidParamSchema, invitationId: uuidParamSchema })
)
export const documentUserParams = validatedParams(
  v.object({ documentId: uuidParamSchema, userId: textParamSchema })
)
export const workspaceParams = validatedParams(v.object({ workspaceId: uuidParamSchema }))
export const workspaceInvitationParams = validatedParams(
  v.object({ workspaceId: uuidParamSchema, invitationId: uuidParamSchema })
)
export const workspaceMemberParams = validatedParams(
  v.object({ workspaceId: uuidParamSchema, userId: textParamSchema })
)
export const accountParams = validatedParams(v.object({ userId: uuidParamSchema }))
export const shareParams = validatedParams(v.object({ shareId: uuidParamSchema }))
export const communityThumbnailParams = validatedParams(
  v.object({ documentId: uuidParamSchema, revisionId: uuidParamSchema })
)
export const invitationParams = validatedParams(v.object({ invitationId: uuidParamSchema }))
export const invitationContinuationParams = validatedParams(
  v.object({ continuationId: textParamSchema })
)
export const uploadParams = validatedParams(v.object({ uploadId: uuidParamSchema }))
/** Admin records (enrollments, accounts, and messages), all named by UUID. */
export const idParams = validatedParams(v.object({ id: uuidParamSchema }))
/** A picture's address names its owner and a prefix of its checksum, which the service checks. */
export const pictureParams = validatedParams(
  v.object({ userId: textParamSchema, version: textParamSchema })
)

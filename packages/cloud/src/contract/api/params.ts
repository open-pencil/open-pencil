import * as v from 'valibot'

/**
 * A route parameter that names a row by UUID, in lowercase: the database matches any case, but an
 * ID that also names something else, such as a document's relay, must have one spelling. One that
 * is not a UUID names nothing, so the API answers 404 for it.
 */
export const uuidParamSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase())

export const documentParamsSchema = v.object({ documentId: uuidParamSchema })
export const workspaceParamsSchema = v.object({ workspaceId: uuidParamSchema })
export const uploadParamsSchema = v.object({ uploadId: uuidParamSchema })

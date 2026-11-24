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
export const documentVersionParamsSchema = v.object({
  documentId: uuidParamSchema,
  versionId: uuidParamSchema
})
export const documentThreadParamsSchema = v.object({
  documentId: uuidParamSchema,
  threadId: uuidParamSchema
})
export const documentCommentParamsSchema = v.object({
  ...documentThreadParamsSchema.entries,
  commentId: uuidParamSchema
})
export const shareParamsSchema = v.object({ shareId: uuidParamSchema })
export const shareThreadParamsSchema = v.object({
  shareId: uuidParamSchema,
  threadId: uuidParamSchema
})
export const shareCommentParamsSchema = v.object({
  ...shareThreadParamsSchema.entries,
  commentId: uuidParamSchema
})

import * as v from 'valibot'

/**
 * A route parameter that names a row by UUID, in lowercase: the database matches any case, but an
 * ID that also names something else, such as a document's relay, must have one spelling. One that
 * is not a UUID names nothing, so the API answers 404 for it.
 */
export const uuidParamSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase())

export const documentParamsSchema = v.object({ documentId: uuidParamSchema })
export const workspaceParamsSchema = v.object({ workspaceId: uuidParamSchema })
/** A route parameter the server takes as text, such as a user ID, which is not a UUID column. */
const textParamSchema = v.pipe(v.string(), v.minLength(1))

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
export const documentUserParamsSchema = v.object({
  documentId: uuidParamSchema,
  userId: textParamSchema
})
export const documentShareParamsSchema = v.object({
  documentId: uuidParamSchema,
  shareId: uuidParamSchema
})
export const documentInvitationParamsSchema = v.object({
  documentId: uuidParamSchema,
  invitationId: uuidParamSchema
})
export const invitationParamsSchema = v.object({ invitationId: uuidParamSchema })
export const invitationContinuationParamsSchema = v.object({ continuationId: textParamSchema })

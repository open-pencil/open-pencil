import * as v from 'valibot'

import { resolveDocumentShareSchema } from './sharing'

/** The most a comment may say, in characters. */
export const COMMENT_BODY_MAX_LENGTH = 10_000
/** The most threads one document may hold, resolved ones included. */
export const MAX_COMMENT_THREADS_PER_DOCUMENT = 5_000
/** The most comments one thread may hold, its first one included. */
export const MAX_COMMENTS_PER_THREAD = 500
const NAME_MAX_LENGTH = 255
const ID_MAX_LENGTH = 200

/**
 * Who wrote a comment: an account, whose name is null once it is deleted, or a name a file gave
 * when the comment came in with it, which no account vouches for.
 */
export const commentAuthorSchema = v.variant('kind', [
  v.object({ kind: v.literal('user'), id: v.string(), name: v.nullable(v.string()) }),
  v.object({ kind: v.literal('imported'), name: v.string() })
])
export type CommentAuthor = v.InferOutput<typeof commentAuthorSchema>

export const cloudCommentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  author: commentAuthorSchema,
  /** The agent that wrote it on its author's behalf. */
  agent: v.nullable(v.string()),
  /** Markdown, as the editor writes it. */
  body: v.string(),
  createdAt: v.string(),
  editedAt: v.nullable(v.string())
})
export type CloudComment = v.InferOutput<typeof cloudCommentSchema>

/** Where a pin sits, as the editor places it. */
const commentAnchorEntries = {
  pageId: v.pipe(v.string(), v.minLength(1), v.maxLength(ID_MAX_LENGTH)),
  pageName: v.nullable(v.pipe(v.string(), v.maxLength(NAME_MAX_LENGTH))),
  /** The top-level layer the pin follows, if any. */
  nodeId: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(ID_MAX_LENGTH))),
  nodeName: v.nullable(v.pipe(v.string(), v.maxLength(NAME_MAX_LENGTH))),
  /** The pin's offset from the layer's top-left corner. */
  offsetX: v.nullable(v.pipe(v.number(), v.finite())),
  offsetY: v.nullable(v.pipe(v.number(), v.finite())),
  /** The pin's canvas position, used once the layer is gone. */
  x: v.pipe(v.number(), v.finite()),
  y: v.pipe(v.number(), v.finite())
}
export const commentAnchorSchema = v.object(commentAnchorEntries)
export type CommentAnchor = v.InferOutput<typeof commentAnchorSchema>

export const cloudCommentThreadSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  ...commentAnchorEntries,
  createdAt: v.string(),
  /** When anything in the thread last changed: a comment, the pin, or whether it is resolved. */
  updatedAt: v.string(),
  resolvedAt: v.nullable(v.string()),
  resolvedBy: v.nullable(v.string()),
  /** Oldest first; the first is what started the thread. */
  comments: v.array(cloudCommentSchema)
})
export type CloudCommentThread = v.InferOutput<typeof cloudCommentThreadSchema>

/** What the person asking may do with the document's comments. */
export const commentAccessSchema = v.object({
  /** Start threads, reply, and change their own comments; anyone signed in who can view. */
  canComment: v.boolean(),
  /** Delete anyone's comments; editors. */
  canModerate: v.boolean()
})
export type CommentAccess = v.InferOutput<typeof commentAccessSchema>

export const commentThreadsSchema = v.object({
  threads: v.array(cloudCommentThreadSchema),
  access: commentAccessSchema
})
export type CommentThreads = v.InferOutput<typeof commentThreadsSchema>

export const commentThreadResponseSchema = v.object({ thread: cloudCommentThreadSchema })

const bodySchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(COMMENT_BODY_MAX_LENGTH)
)
const agentSchema = v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)))

export const createCommentThreadSchema = v.object({
  ...commentAnchorEntries,
  body: bodySchema,
  agent: agentSchema
})
export type CreateCommentThreadInput = v.InferOutput<typeof createCommentThreadSchema>

/** Resolves or reopens a thread, or moves its pin; what is left out stays as it is. */
export const updateCommentThreadSchema = v.object({
  resolved: v.optional(v.boolean()),
  anchor: v.optional(commentAnchorSchema)
})
export type UpdateCommentThreadInput = v.InferOutput<typeof updateCommentThreadSchema>

export const createCommentSchema = v.object({ body: bodySchema, agent: agentSchema })
export type CreateCommentInput = v.InferOutput<typeof createCommentSchema>

export const updateCommentSchema = v.object({ body: bodySchema })
export type UpdateCommentInput = v.InferOutput<typeof updateCommentSchema>

/**
 * The same requests made through a share link: the link's secret rides in the body, as it does
 * for opening the document, since it must stay out of the address.
 */
const shareEntries = { share: v.pick(resolveDocumentShareSchema, ['secret']) }
export const sharedCommentsRequestSchema = v.object(shareEntries)
export const sharedCreateCommentThreadSchema = v.object({
  ...shareEntries,
  ...createCommentThreadSchema.entries
})
export const sharedUpdateCommentThreadSchema = v.object({
  ...shareEntries,
  ...updateCommentThreadSchema.entries
})
export const sharedCreateCommentSchema = v.object({
  ...shareEntries,
  ...createCommentSchema.entries
})
export const sharedUpdateCommentSchema = v.object({
  ...shareEntries,
  ...updateCommentSchema.entries
})
export type SharedCommentsRequest = v.InferOutput<typeof sharedCommentsRequestSchema>

export const parseCreateCommentThread = (input: unknown) =>
  v.parse(createCommentThreadSchema, input)
export const parseUpdateCommentThread = (input: unknown) =>
  v.parse(updateCommentThreadSchema, input)
export const parseCreateComment = (input: unknown) => v.parse(createCommentSchema, input)
export const parseUpdateComment = (input: unknown) => v.parse(updateCommentSchema, input)
export const parseSharedCommentsRequest = (input: unknown) =>
  v.parse(sharedCommentsRequestSchema, input)
export const parseSharedCreateCommentThread = (input: unknown) =>
  v.parse(sharedCreateCommentThreadSchema, input)
export const parseSharedUpdateCommentThread = (input: unknown) =>
  v.parse(sharedUpdateCommentThreadSchema, input)
export const parseSharedCreateComment = (input: unknown) =>
  v.parse(sharedCreateCommentSchema, input)
export const parseSharedUpdateComment = (input: unknown) =>
  v.parse(sharedUpdateCommentSchema, input)

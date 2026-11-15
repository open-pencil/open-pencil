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
  /** The accounts it names, which hear about it. */
  mentions: v.array(v.string()),
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
  /** Whether someone else wrote in it since the asker last read it; false for a guest. */
  unread: v.boolean(),
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
/** The most accounts one comment names. */
export const MAX_COMMENT_MENTIONS = 50
/** The accounts a comment names; the server keeps those who can read the document. */
const mentionsSchema = v.optional(
  v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
    v.maxLength(MAX_COMMENT_MENTIONS)
  ),
  []
)
const agentSchema = v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)))
/**
 * The ID the editor gave a new thread or comment, so it keeps showing it as the server's, and a
 * request sent again finds what the first one made.
 */
const clientIdSchema = v.optional(v.pipe(v.string(), v.uuid()))

export const createCommentThreadSchema = v.object({
  id: clientIdSchema,
  ...commentAnchorEntries,
  body: bodySchema,
  mentions: mentionsSchema,
  agent: agentSchema
})
export type CreateCommentThreadInput = v.InferOutput<typeof createCommentThreadSchema>

/** Resolves or reopens a thread, or moves its pin; what is left out stays as it is. */
export const updateCommentThreadSchema = v.object({
  resolved: v.optional(v.boolean()),
  anchor: v.optional(commentAnchorSchema)
})
export type UpdateCommentThreadInput = v.InferOutput<typeof updateCommentThreadSchema>

export const createCommentSchema = v.object({
  id: clientIdSchema,
  body: bodySchema,
  mentions: mentionsSchema,
  agent: agentSchema
})
export type CreateCommentInput = v.InferOutput<typeof createCommentSchema>

export const updateCommentSchema = v.object({ body: bodySchema, mentions: mentionsSchema })
export type UpdateCommentInput = v.InferOutput<typeof updateCommentSchema>

/** Someone a comment may name: an account that can open the document. */
export const commentPersonSchema = v.object({
  id: v.string(),
  name: v.string(),
  image: v.nullable(v.string())
})
export type CommentPerson = v.InferOutput<typeof commentPersonSchema>
export const commentPeopleSchema = v.object({ people: v.array(commentPersonSchema) })

/** Which comments an account hears about by email. */
export const commentEmailSettingSchema = v.picklist(['all', 'mentions', 'off'])
export type CommentEmailSetting = v.InferOutput<typeof commentEmailSettingSchema>
export const notificationSettingsSchema = v.object({ commentEmails: commentEmailSettingSchema })
export type NotificationSettings = v.InferOutput<typeof notificationSettingsSchema>
export const parseNotificationSettings = (input: unknown) =>
  v.parse(notificationSettingsSchema, input)

/** The most threads, and comments in all, one import brings in. */
export const MAX_IMPORTED_COMMENT_THREADS = 1_000
export const MAX_IMPORTED_COMMENTS = 10_000

/**
 * Threads a file held when it moved to Cloud. Their authors are names the file gave, which the
 * server keeps as such; their times are the file's.
 */
export const importCommentThreadsSchema = v.object({
  threads: v.pipe(
    v.array(
      v.object({
        ...commentAnchorEntries,
        createdAt: v.pipe(v.string(), v.isoTimestamp()),
        resolved: v.boolean(),
        comments: v.pipe(
          v.array(
            v.object({
              authorName: v.pipe(v.string(), v.trim(), v.maxLength(NAME_MAX_LENGTH)),
              body: bodySchema,
              createdAt: v.pipe(v.string(), v.isoTimestamp())
            })
          ),
          v.minLength(1),
          v.maxLength(MAX_COMMENTS_PER_THREAD)
        )
      })
    ),
    v.maxLength(MAX_IMPORTED_COMMENT_THREADS),
    v.check(
      (threads) =>
        threads.reduce((total, thread) => total + thread.comments.length, 0) <=
        MAX_IMPORTED_COMMENTS,
      `An import brings in at most ${MAX_IMPORTED_COMMENTS} comments`
    )
  )
})
export type ImportCommentThreadsInput = v.InferOutput<typeof importCommentThreadsSchema>

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
export const parseImportCommentThreads = (input: unknown) =>
  v.parse(importCommentThreadsSchema, input)
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

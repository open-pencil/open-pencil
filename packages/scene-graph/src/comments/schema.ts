import * as v from 'valibot'

import type { CommentThread } from '../types'

// Lenient on purpose: other tools may write comments, so missing fields get defaults and one
// malformed thread is skipped instead of hiding every comment.
const commentAuthorColorSchema = v.fallback(
  v.optional(v.object({ r: v.number(), g: v.number(), b: v.number(), a: v.number() })),
  undefined
)

/** What a comment and each reply say, who wrote them and when, and whether they were deleted. */
const commentEntry = {
  author: v.fallback(v.string(), ''),
  authorColor: commentAuthorColorSchema,
  text: v.fallback(v.string(), ''),
  createdAt: v.fallback(v.string(), ''),
  deleted: v.optional(v.boolean())
}

const commentReplySchema = v.object({ id: v.string(), ...commentEntry })

const commentThreadSchema = v.object({
  id: v.string(),
  pageId: v.string(),
  pageName: v.optional(v.string()),
  nodeId: v.optional(v.nullable(v.string())),
  nodeName: v.optional(v.nullable(v.string())),
  offsetX: v.optional(v.number()),
  offsetY: v.optional(v.number()),
  x: v.fallback(v.number(), 0),
  y: v.fallback(v.number(), 0),
  ...commentEntry,
  updatedAt: v.fallback(v.string(), ''),
  resolved: v.fallback(v.boolean(), false),
  resolvedAt: v.optional(v.nullable(v.string())),
  replies: v.fallback(v.array(commentReplySchema), [])
})

/** A list of comment threads as files and rooms hold them; threads that cannot be read are left out. */
export const commentThreadsSchema: v.GenericSchema<unknown, CommentThread[]> = v.pipe(
  v.array(v.unknown()),
  v.transform((items) =>
    items.flatMap((item) => {
      const parsed = v.safeParse(commentThreadSchema, item)
      if (!parsed.success) return []
      const thread = parsed.output
      return [{ ...thread, updatedAt: thread.updatedAt || thread.createdAt }]
    })
  )
)

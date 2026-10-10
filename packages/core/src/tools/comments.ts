import * as v from 'valibot'

import { DEFAULT_COMMENT_AUTHOR, OpenPencilAPI } from '#core/openpencil-api'
import { defineTool, toolFailure } from '#core/tools/schema'

const author = v.optional(
  v.pipe(
    v.string(),
    v.description(
      `Name shown as the author, such as your agent's name; "${DEFAULT_COMMENT_AUTHOR}" if omitted`
    )
  )
)

export const getComments = defineTool({
  name: 'get_comments',
  description:
    'Read the comments people left on the canvas, oldest first: each thread with its text, ' +
    'author, page, the layer it is pinned to, its position, replies, and whether it is ' +
    'resolved. Open threads only unless includeResolved is set. Use it to find review ' +
    'feedback to act on, then reply_to_comment and resolve_comment.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    includeResolved: v.optional(v.pipe(v.boolean(), v.description('Also list resolved threads'))),
    page: v.optional(v.pipe(v.string(), v.description('Only threads on this page ID'))),
    author: v.optional(
      v.pipe(v.string(), v.description('Only threads this person started or replied to'))
    )
  }),
  execute: (figma, { includeResolved, page, author }) => {
    try {
      const comments = new OpenPencilAPI(figma).getComments({
        resolved: includeResolved ? undefined : false,
        page,
        author
      })
      return { comments: comments.map((comment) => comment.toJSON()) }
    } catch (error) {
      return toolFailure(error)
    }
  }
})

export const addComment = defineTool({
  name: 'add_comment',
  description:
    'Leave a comment on the canvas, as a person does with the Comment tool: pinned on a layer ' +
    'by ID, which it then follows, or at x, y on a page. Text may use Markdown: **bold**, ' +
    '*italic*, ~~strikethrough~~, [links](https://…), and - or 1. lists.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    text: v.pipe(v.string(), v.minLength(1), v.description('The comment, in Markdown')),
    node: v.optional(v.pipe(v.string(), v.description('Layer ID to pin the comment on'))),
    page: v.optional(
      v.pipe(v.string(), v.description('Page ID without a layer; the current page if omitted'))
    ),
    x: v.optional(
      v.pipe(v.number(), v.description('Canvas X, or offset from the layer’s left edge'))
    ),
    y: v.optional(
      v.pipe(v.number(), v.description('Canvas Y, or offset from the layer’s top edge'))
    ),
    author
  }),
  execute: (figma, { text, ...options }) => {
    try {
      return new OpenPencilAPI(figma).addComment(text, options).toJSON()
    } catch (error) {
      return toolFailure(error)
    }
  }
})

export const replyToComment = defineTool({
  name: 'reply_to_comment',
  description:
    'Answer a comment thread by ID from get_comments, for example to say what you changed. A ' +
    'reply reopens a resolved thread. Text may use Markdown, as in add_comment.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Comment thread ID')),
    text: v.pipe(v.string(), v.minLength(1), v.description('The reply, in Markdown')),
    author
  }),
  execute: (figma, { id, text, author }) => {
    try {
      const comment = new OpenPencilAPI(figma).getComment(id)
      if (!comment) return { error: `No comment ${id}` }
      return comment.reply(text, { author }).toJSON()
    } catch (error) {
      return toolFailure(error)
    }
  }
})

export const resolveComment = defineTool({
  name: 'resolve_comment',
  description:
    'Mark a comment thread by ID as resolved once its feedback is addressed, which hides it ' +
    'from the canvas and the open list; pass resolved: false to reopen it.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Comment thread ID')),
    resolved: v.optional(
      v.pipe(v.boolean(), v.description('false reopens the thread; true by default'))
    )
  }),
  execute: (figma, { id, resolved = true }) => {
    try {
      const comment = new OpenPencilAPI(figma).getComment(id)
      if (!comment) return { error: `No comment ${id}` }
      return (resolved ? comment.resolve() : comment.reopen()).toJSON()
    } catch (error) {
      return toolFailure(error)
    }
  }
})

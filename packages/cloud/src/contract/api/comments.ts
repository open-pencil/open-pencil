import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import * as v from 'valibot'

import {
  commentPeopleSchema,
  commentThreadResponseSchema,
  commentThreadsSchema,
  createCommentSchema,
  createCommentThreadSchema,
  importCommentThreadsSchema,
  notificationSettingsSchema,
  sharedCommentsRequestSchema,
  sharedCreateCommentSchema,
  sharedCreateCommentThreadSchema,
  sharedUpdateCommentSchema,
  sharedUpdateCommentThreadSchema,
  updateCommentSchema,
  updateCommentThreadSchema
} from '../comments'
import { COMMENT_ERRORS, DOCUMENT_ERRORS, SHARE_ERRORS } from './errors'
import {
  documentCommentParamsSchema,
  documentParamsSchema,
  documentThreadParamsSchema,
  shareCommentParamsSchema,
  shareParamsSchema,
  shareThreadParamsSchema
} from './params'
import { at } from './route'

/**
 * The thread after deleting one of its comments, or no content once the thread went with its
 * first.
 */
const threadOrGoneSchema = v.union([
  v.object({ status: v.literal(200), body: commentThreadResponseSchema }),
  v.object({ status: v.literal(204) })
])

const member = oc.errors({ ...DOCUMENT_ERRORS, ...COMMENT_ERRORS })
const guest = oc.errors({ ...SHARE_ERRORS, ...COMMENT_ERRORS })

/** A document's comments for its members and the people it is shared with directly. */
export const commentsContract = {
  notificationSettings: member
    .meta(openapi({ method: 'GET', path: '/account/notifications' }))
    .output(notificationSettingsSchema),
  setNotificationSettings: member
    .meta(at('PUT', '/account/notifications'))
    .input(v.object({ body: notificationSettingsSchema }))
    .output(notificationSettingsSchema),
  people: member
    .meta(at('GET', '/documents/{documentId}/threads/people'))
    .input(v.object({ params: documentParamsSchema }))
    .output(commentPeopleSchema),
  list: member
    .meta(at('GET', '/documents/{documentId}/threads'))
    .input(v.object({ params: documentParamsSchema }))
    .output(commentThreadsSchema),
  createThread: member
    .meta(at('POST', '/documents/{documentId}/threads', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: createCommentThreadSchema }))
    .output(commentThreadResponseSchema),
  importThreads: member
    .meta(at('POST', '/documents/{documentId}/threads/import', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: importCommentThreadsSchema }))
    .output(commentThreadsSchema),
  get: member
    .meta(at('GET', '/documents/{documentId}/threads/{threadId}'))
    .input(v.object({ params: documentThreadParamsSchema }))
    .output(commentThreadResponseSchema),
  markRead: member
    .meta(at('POST', '/documents/{documentId}/threads/{threadId}/read', { successStatus: 204 }))
    .input(v.object({ params: documentThreadParamsSchema })),
  updateThread: member
    .meta(at('PATCH', '/documents/{documentId}/threads/{threadId}'))
    .input(v.object({ params: documentThreadParamsSchema, body: updateCommentThreadSchema }))
    .output(commentThreadResponseSchema),
  deleteThread: member
    .meta(at('DELETE', '/documents/{documentId}/threads/{threadId}', { successStatus: 204 }))
    .input(v.object({ params: documentThreadParamsSchema })),
  reply: member
    .meta(at('POST', '/documents/{documentId}/threads/{threadId}/comments', { successStatus: 201 }))
    .input(v.object({ params: documentThreadParamsSchema, body: createCommentSchema }))
    .output(commentThreadResponseSchema),
  updateComment: member
    .meta(at('PATCH', '/documents/{documentId}/threads/{threadId}/comments/{commentId}'))
    .input(v.object({ params: documentCommentParamsSchema, body: updateCommentSchema }))
    .output(commentThreadResponseSchema),
  deleteComment: member
    .meta(
      at('DELETE', '/documents/{documentId}/threads/{threadId}/comments/{commentId}', {
        outputStructure: 'detailed'
      })
    )
    .input(v.object({ params: documentCommentParamsSchema }))
    .output(threadOrGoneSchema)
}

/**
 * The same comments through a share link, whose secret every request carries in its body.
 * Guests read; people signed in to the server also write. Reads are POSTs for the same reason.
 */
export const sharedCommentsContract = {
  list: guest
    .meta(at('POST', '/shares/{shareId}/threads/list'))
    .input(v.object({ params: shareParamsSchema, body: sharedCommentsRequestSchema }))
    .output(commentThreadsSchema),
  createThread: guest
    .meta(at('POST', '/shares/{shareId}/threads', { successStatus: 201 }))
    .input(v.object({ params: shareParamsSchema, body: sharedCreateCommentThreadSchema }))
    .output(commentThreadResponseSchema),
  get: guest
    .meta(at('POST', '/shares/{shareId}/threads/{threadId}/get'))
    .input(v.object({ params: shareThreadParamsSchema, body: sharedCommentsRequestSchema }))
    .output(commentThreadResponseSchema),
  markRead: guest
    .meta(at('POST', '/shares/{shareId}/threads/{threadId}/read', { successStatus: 204 }))
    .input(v.object({ params: shareThreadParamsSchema, body: sharedCommentsRequestSchema })),
  updateThread: guest
    .meta(at('PATCH', '/shares/{shareId}/threads/{threadId}'))
    .input(v.object({ params: shareThreadParamsSchema, body: sharedUpdateCommentThreadSchema }))
    .output(commentThreadResponseSchema),
  deleteThread: guest
    .meta(at('DELETE', '/shares/{shareId}/threads/{threadId}', { successStatus: 204 }))
    .input(v.object({ params: shareThreadParamsSchema, body: sharedCommentsRequestSchema })),
  reply: guest
    .meta(at('POST', '/shares/{shareId}/threads/{threadId}/comments', { successStatus: 201 }))
    .input(v.object({ params: shareThreadParamsSchema, body: sharedCreateCommentSchema }))
    .output(commentThreadResponseSchema),
  updateComment: guest
    .meta(at('PATCH', '/shares/{shareId}/threads/{threadId}/comments/{commentId}'))
    .input(v.object({ params: shareCommentParamsSchema, body: sharedUpdateCommentSchema }))
    .output(commentThreadResponseSchema),
  deleteComment: guest
    .meta(
      at('DELETE', '/shares/{shareId}/threads/{threadId}/comments/{commentId}', {
        outputStructure: 'detailed'
      })
    )
    .input(v.object({ params: shareCommentParamsSchema, body: sharedCommentsRequestSchema }))
    .output(threadOrGoneSchema)
}

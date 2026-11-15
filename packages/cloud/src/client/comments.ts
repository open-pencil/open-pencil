import {
  commentPeopleSchema,
  commentThreadResponseSchema,
  notificationSettingsSchema,
  commentThreadsSchema,
  type CloudCommentThread,
  type CommentPerson,
  type NotificationSettings,
  type CommentThreads,
  type CreateCommentInput,
  type CreateCommentThreadInput,
  type ImportCommentThreadsInput,
  type UpdateCommentInput,
  type UpdateCommentThreadInput
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'
import * as v from 'valibot'

import { parseResponse, type CloudClientDiagnostic, type CloudResponse } from './response'

/** A thread after deleting one of its comments; null once the thread went with its first. */
const threadOrGoneSchema = v.nullable(commentThreadResponseSchema)

/**
 * What every way of reaching a document's comments does, through membership or a link: the app
 * talks to one without asking which it is.
 */
export type CloudCommentRequests = {
  list(): Promise<CommentThreads>
  get(threadId: string): Promise<CloudCommentThread>
  createThread(input: CreateCommentThreadInput): Promise<CloudCommentThread>
  updateThread(threadId: string, input: UpdateCommentThreadInput): Promise<CloudCommentThread>
  deleteThread(threadId: string): Promise<void>
  reply(threadId: string, input: CreateCommentInput): Promise<CloudCommentThread>
  updateComment(
    threadId: string,
    commentId: string,
    input: UpdateCommentInput
  ): Promise<CloudCommentThread>
  deleteComment(threadId: string, commentId: string): Promise<CloudCommentThread | null>
  /** Records that the signed-in account read the thread as it is now. */
  markRead(threadId: string): Promise<void>
}

async function thread(request: Promise<CloudResponse>, onDiagnostic?: CloudClientDiagnostic) {
  return (await parseResponse(request, commentThreadResponseSchema, onDiagnostic)).thread
}

async function threadOrGone(request: Promise<CloudResponse>, onDiagnostic?: CloudClientDiagnostic) {
  return (await parseResponse(request, threadOrGoneSchema, onDiagnostic))?.thread ?? null
}

/** Comment requests for documents people reach through membership or a direct grant. */
export function createCommentRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    /** The comments of a document the signed-in account can open. */
    documentComments(documentId: string): CloudCommentRequests {
      const threads = client.documents[':documentId'].threads
      const one = threads[':threadId']
      const comment = one.comments[':commentId']
      return {
        list: () =>
          parseResponse(
            threads.$get({ param: { documentId } }),
            commentThreadsSchema,
            onDiagnostic
          ),
        get: (threadId) => thread(one.$get({ param: { documentId, threadId } }), onDiagnostic),
        createThread: (json) =>
          thread(threads.$post({ param: { documentId }, json }), onDiagnostic),
        updateThread: (threadId, json) =>
          thread(one.$patch({ param: { documentId, threadId }, json }), onDiagnostic),
        deleteThread: async (threadId) => {
          await parseResponse(
            one.$delete({ param: { documentId, threadId } }),
            v.null(),
            onDiagnostic
          )
        },
        reply: (threadId, json) =>
          thread(one.comments.$post({ param: { documentId, threadId }, json }), onDiagnostic),
        updateComment: (threadId, commentId, json) =>
          thread(
            comment.$patch({ param: { documentId, threadId, commentId }, json }),
            onDiagnostic
          ),
        deleteComment: (threadId, commentId) =>
          threadOrGone(
            comment.$delete({ param: { documentId, threadId, commentId } }),
            onDiagnostic
          ),
        markRead: async (threadId) => {
          await parseResponse(
            one.read.$post({ param: { documentId, threadId } }),
            v.null(),
            onDiagnostic
          )
        }
      }
    },

    /** Whom the signed-in account may name in a document's comments. */
    async commentPeople(documentId: string): Promise<CommentPerson[]> {
      const response = await parseResponse(
        client.documents[':documentId'].threads.people.$get({ param: { documentId } }),
        commentPeopleSchema,
        onDiagnostic
      )
      return response.people
    },

    /** Which comments the signed-in account hears about by email. */
    notificationSettings(): Promise<NotificationSettings> {
      return parseResponse(
        client.account.notifications.$get(),
        notificationSettingsSchema,
        onDiagnostic
      )
    },
    setNotificationSettings(json: NotificationSettings): Promise<NotificationSettings> {
      return parseResponse(
        client.account.notifications.$put({ json }),
        notificationSettingsSchema,
        onDiagnostic
      )
    },

    /** Brings a file's threads into a document that just moved to Cloud. */
    async importCommentThreads(
      documentId: string,
      json: ImportCommentThreadsInput
    ): Promise<CommentThreads> {
      return parseResponse(
        client.documents[':documentId'].threads.import.$post({ param: { documentId }, json }),
        commentThreadsSchema,
        onDiagnostic
      )
    }
  }
}

/** Comment requests through a share link, whose secret every request carries in its body. */
export function createSharedCommentRequests(
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    sharedComments(shareId: string, secret: string): CloudCommentRequests {
      const share = { secret }
      const threads = publicClient.shares[':shareId'].threads
      const one = threads[':threadId']
      const comment = one.comments[':commentId']
      return {
        list: () =>
          parseResponse(
            threads.list.$post({ param: { shareId }, json: { share } }),
            commentThreadsSchema,
            onDiagnostic
          ),
        get: (threadId) =>
          thread(one.get.$post({ param: { shareId, threadId }, json: { share } }), onDiagnostic),
        createThread: (input) =>
          thread(threads.$post({ param: { shareId }, json: { share, ...input } }), onDiagnostic),
        updateThread: (threadId, input) =>
          thread(
            one.$patch({ param: { shareId, threadId }, json: { share, ...input } }),
            onDiagnostic
          ),
        deleteThread: async (threadId) => {
          await parseResponse(
            one.$delete({ param: { shareId, threadId }, json: { share } }),
            v.null(),
            onDiagnostic
          )
        },
        reply: (threadId, input) =>
          thread(
            one.comments.$post({ param: { shareId, threadId }, json: { share, ...input } }),
            onDiagnostic
          ),
        updateComment: (threadId, commentId, input) =>
          thread(
            comment.$patch({ param: { shareId, threadId, commentId }, json: { share, ...input } }),
            onDiagnostic
          ),
        deleteComment: (threadId, commentId) =>
          threadOrGone(
            comment.$delete({ param: { shareId, threadId, commentId }, json: { share } }),
            onDiagnostic
          ),
        markRead: async (threadId) => {
          await parseResponse(
            one.read.$post({ param: { shareId, threadId }, json: { share } }),
            v.null(),
            onDiagnostic
          )
        }
      }
    }
  }
}

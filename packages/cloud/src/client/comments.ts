import type {
  CloudCommentThread,
  CommentPerson,
  CommentThreads,
  CreateCommentInput,
  CreateCommentThreadInput,
  ImportCommentThreadsInput,
  NotificationSettings,
  UpdateCommentInput,
  UpdateCommentThreadInput
} from '#cloud/contract'

import type { CloudContractClient } from './contract'

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

/** The thread a delete left, or null once the thread went with its first comment. */
function remaining(
  answer: { status: 200; body: { thread: CloudCommentThread } } | { status: 204 }
) {
  return answer.status === 200 ? answer.body.thread : null
}

/** Comment requests for documents people reach through membership or a direct grant. */
export function createCommentRequests(contract: CloudContractClient['comments']) {
  return {
    /** The comments of a document the signed-in account can open. */
    documentComments(documentId: string): CloudCommentRequests {
      const thread = (threadId: string) => ({ documentId, threadId })
      return {
        list: () => contract.list({ params: { documentId } }),
        get: async (threadId) => (await contract.get({ params: thread(threadId) })).thread,
        createThread: async (body) =>
          (await contract.createThread({ params: { documentId }, body })).thread,
        updateThread: async (threadId, body) =>
          (await contract.updateThread({ params: thread(threadId), body })).thread,
        deleteThread: async (threadId) => {
          await contract.deleteThread({ params: thread(threadId) })
        },
        reply: async (threadId, body) =>
          (await contract.reply({ params: thread(threadId), body })).thread,
        updateComment: async (threadId, commentId, body) =>
          (await contract.updateComment({ params: { ...thread(threadId), commentId }, body }))
            .thread,
        deleteComment: async (threadId, commentId) =>
          remaining(await contract.deleteComment({ params: { ...thread(threadId), commentId } })),
        markRead: async (threadId) => {
          await contract.markRead({ params: thread(threadId) })
        }
      }
    },

    /** Whom the signed-in account may name in a document's comments. */
    async commentPeople(documentId: string): Promise<CommentPerson[]> {
      return (await contract.people({ params: { documentId } })).people
    },

    /** Which comments the signed-in account hears about by email. */
    notificationSettings(): Promise<NotificationSettings> {
      return contract.notificationSettings()
    },
    setNotificationSettings(body: NotificationSettings): Promise<NotificationSettings> {
      return contract.setNotificationSettings({ body })
    },

    /** Brings a file's threads into a document that just moved to Cloud. */
    importCommentThreads(
      documentId: string,
      body: ImportCommentThreadsInput
    ): Promise<CommentThreads> {
      return contract.importThreads({ params: { documentId }, body })
    }
  }
}

/** Comment requests through a share link, whose secret every request carries in its body. */
export function createSharedCommentRequests(contract: CloudContractClient['sharedComments']) {
  return {
    sharedComments(shareId: string, secret: string): CloudCommentRequests {
      const share = { secret }
      const thread = (threadId: string) => ({ shareId, threadId })
      return {
        list: () => contract.list({ params: { shareId }, body: { share } }),
        get: async (threadId) =>
          (await contract.get({ params: thread(threadId), body: { share } })).thread,
        createThread: async (input) =>
          (await contract.createThread({ params: { shareId }, body: { share, ...input } })).thread,
        updateThread: async (threadId, input) =>
          (await contract.updateThread({ params: thread(threadId), body: { share, ...input } }))
            .thread,
        deleteThread: async (threadId) => {
          await contract.deleteThread({ params: thread(threadId), body: { share } })
        },
        reply: async (threadId, input) =>
          (await contract.reply({ params: thread(threadId), body: { share, ...input } })).thread,
        updateComment: async (threadId, commentId, input) =>
          (
            await contract.updateComment({
              params: { ...thread(threadId), commentId },
              body: { share, ...input }
            })
          ).thread,
        deleteComment: async (threadId, commentId) =>
          remaining(
            await contract.deleteComment({
              params: { ...thread(threadId), commentId },
              body: { share }
            })
          ),
        markRead: async (threadId) => {
          await contract.markRead({ params: thread(threadId), body: { share } })
        }
      }
    }
  }
}

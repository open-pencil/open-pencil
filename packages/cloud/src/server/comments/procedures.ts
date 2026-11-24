import { commentsContract, sharedCommentsContract, type CloudAPIErrorCode } from '#cloud/contract'
import type { CloudActor, CloudSessionResolver } from '#cloud/server/auth'
import { documentErrors } from '#cloud/server/documents/procedures'
import { shareActor } from '#cloud/server/sharing/actor'
import { sharingErrors } from '#cloud/server/sharing/http'
import { ORPCError } from '@orpc/client'
import { implement } from '@orpc/server'

import { CommentConflictError, CommentLimitError, type CommentService } from './service'

/** The code a comment domain error answers with, or null for any other error. */
function commentErrorCode(error: unknown): CloudAPIErrorCode | null {
  if (error instanceof CommentLimitError) return 'comment_limit_reached'
  if (error instanceof CommentConflictError) return 'comment_conflict'
  return null
}

async function commentErrors<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next()
  } catch (error) {
    const code = commentErrorCode(error)
    if (code) throw new ORPCError(code, { cause: error })
    throw error
  }
}

/** A thread after deleting one of its comments, or no content once the thread went with it. */
function threadOrGone(thread: Awaited<ReturnType<CommentService['get']>> | null) {
  return thread ? { status: 200 as const, body: { thread } } : { status: 204 as const }
}

/** A document's comments, as the contract describes them, for the signed-in actor. */
export function createCommentProcedures(service: CommentService) {
  const comments = implement(commentsContract)
    .$context<{ actor: CloudActor }>()
    .use(documentErrors)
    .use(commentErrors)
  const as = (actor: CloudActor, documentId: string) => service.forMember(actor.userId, documentId)
  return comments.router({
    notificationSettings: comments.notificationSettings.handler(({ context }) =>
      service.notificationSettings(context.actor.userId)
    ),
    setNotificationSettings: comments.setNotificationSettings.handler(({ context, input }) =>
      service.setNotificationSettings(context.actor.userId, input.body)
    ),
    people: comments.people.handler(async ({ context, input }) =>
      service.people(await as(context.actor, input.params.documentId))
    ),
    list: comments.list.handler(async ({ context, input }) =>
      service.list(await as(context.actor, input.params.documentId))
    ),
    createThread: comments.createThread.handler(async ({ context, input }) => ({
      thread: await service.createThread(
        await as(context.actor, input.params.documentId),
        input.body
      )
    })),
    importThreads: comments.importThreads.handler(async ({ context, input }) =>
      service.importThreads(await as(context.actor, input.params.documentId), input.body)
    ),
    get: comments.get.handler(async ({ context, input }) => ({
      thread: await service.get(
        await as(context.actor, input.params.documentId),
        input.params.threadId
      )
    })),
    markRead: comments.markRead.handler(async ({ context, input }) => {
      await service.markRead(
        await as(context.actor, input.params.documentId),
        input.params.threadId
      )
    }),
    updateThread: comments.updateThread.handler(async ({ context, input }) => ({
      thread: await service.updateThread(
        await as(context.actor, input.params.documentId),
        input.params.threadId,
        input.body
      )
    })),
    deleteThread: comments.deleteThread.handler(async ({ context, input }) => {
      await service.deleteThread(
        await as(context.actor, input.params.documentId),
        input.params.threadId
      )
    }),
    reply: comments.reply.handler(async ({ context, input }) => ({
      thread: await service.reply(
        await as(context.actor, input.params.documentId),
        input.params.threadId,
        input.body
      )
    })),
    updateComment: comments.updateComment.handler(async ({ context, input }) => ({
      thread: await service.updateComment(
        await as(context.actor, input.params.documentId),
        input.params.threadId,
        input.params.commentId,
        input.body
      )
    })),
    deleteComment: comments.deleteComment.handler(async ({ context, input }) =>
      threadOrGone(
        await service.deleteComment(
          await as(context.actor, input.params.documentId),
          input.params.threadId,
          input.params.commentId
        )
      )
    )
  })
}

/**
 * The same comments through a share link, whose secret every request carries in its body, for
 * whoever follows it: a guest, or the person signed in to the server.
 */
export function createSharedCommentProcedures(
  service: CommentService,
  resolveSession?: CloudSessionResolver
) {
  const comments = implement(sharedCommentsContract)
    .$context<{ request: Request }>()
    .use(sharingErrors)
    .use(commentErrors)
  const as = async (request: Request, shareId: string, secret: string) =>
    service.forShare(shareId, secret, await shareActor(request, resolveSession))
  return comments.router({
    list: comments.list.handler(async ({ context, input }) =>
      service.list(await as(context.request, input.params.shareId, input.body.share.secret))
    ),
    createThread: comments.createThread.handler(async ({ context, input }) => {
      const { share, ...thread } = input.body
      return {
        thread: await service.createThread(
          await as(context.request, input.params.shareId, share.secret),
          thread
        )
      }
    }),
    get: comments.get.handler(async ({ context, input }) => ({
      thread: await service.get(
        await as(context.request, input.params.shareId, input.body.share.secret),
        input.params.threadId
      )
    })),
    markRead: comments.markRead.handler(async ({ context, input }) => {
      await service.markRead(
        await as(context.request, input.params.shareId, input.body.share.secret),
        input.params.threadId
      )
    }),
    updateThread: comments.updateThread.handler(async ({ context, input }) => {
      const { share, ...edit } = input.body
      return {
        thread: await service.updateThread(
          await as(context.request, input.params.shareId, share.secret),
          input.params.threadId,
          edit
        )
      }
    }),
    deleteThread: comments.deleteThread.handler(async ({ context, input }) => {
      await service.deleteThread(
        await as(context.request, input.params.shareId, input.body.share.secret),
        input.params.threadId
      )
    }),
    reply: comments.reply.handler(async ({ context, input }) => {
      const { share, ...comment } = input.body
      return {
        thread: await service.reply(
          await as(context.request, input.params.shareId, share.secret),
          input.params.threadId,
          comment
        )
      }
    }),
    updateComment: comments.updateComment.handler(async ({ context, input }) => {
      const { share, ...edit } = input.body
      return {
        thread: await service.updateComment(
          await as(context.request, input.params.shareId, share.secret),
          input.params.threadId,
          input.params.commentId,
          edit
        )
      }
    }),
    deleteComment: comments.deleteComment.handler(async ({ context, input }) =>
      threadOrGone(
        await service.deleteComment(
          await as(context.request, input.params.shareId, input.body.share.secret),
          input.params.threadId,
          input.params.commentId
        )
      )
    )
  })
}

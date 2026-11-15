import {
  parseCreateComment,
  parseCreateCommentThread,
  parseSharedCommentsRequest,
  parseSharedCreateComment,
  parseSharedCreateCommentThread,
  parseSharedUpdateComment,
  parseSharedUpdateCommentThread,
  parseUpdateComment,
  parseUpdateCommentThread
} from '#cloud/contract'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { documentDomainError, type DocumentRouteEnvironment } from '#cloud/server/documents'
import { shareActor } from '#cloud/server/sharing/actor'
import { sharingDomainError } from '#cloud/server/sharing/http'
import {
  documentCommentParams,
  documentParams,
  documentThreadParams,
  shareCommentParams,
  shareParams,
  shareThreadParams,
  validatedJSON
} from '#cloud/server/validation'
import { Hono, type Context } from 'hono'

import { CommentLimitError, type CommentActor, type CommentService } from './service'

function commentDomainError(context: Context, error: unknown): Response | null {
  if (error instanceof CommentLimitError) {
    return context.json({ error: { code: 'comment_limit_reached' as const } }, 409)
  }
  return null
}

async function answer(
  context: Context,
  run: () => Promise<Response>,
  domainError: (context: Context, error: unknown) => Response | null
): Promise<Response> {
  try {
    return await run()
  } catch (error) {
    const response = commentDomainError(context, error) ?? domainError(context, error)
    if (response) return response
    throw error
  }
}

/** Answers a thread, or no content when deleting its comment deleted the thread. */
function threadOrGone(context: Context, thread: Awaited<ReturnType<CommentService['get']>> | null) {
  return thread ? context.json({ thread }) : context.body(null, 204)
}

/** A document's comments for its members and the people it is shared with directly. */
export function createCommentRoutes(service: CommentService) {
  const as = (context: Context<DocumentRouteEnvironment>, documentId: string) =>
    service.forMember(context.get('actor').userId, documentId)
  const run = (context: Context<DocumentRouteEnvironment>, respond: () => Promise<Response>) =>
    answer(context, respond, documentDomainError)

  return new Hono<DocumentRouteEnvironment>()
    .get('/documents/:documentId/threads', documentParams, (context) =>
      run(context, async () =>
        context.json(await service.list(await as(context, context.req.valid('param').documentId)))
      )
    )
    .post(
      '/documents/:documentId/threads',
      documentParams,
      validatedJSON(parseCreateCommentThread),
      (context) =>
        run(context, async () => {
          const actor = await as(context, context.req.valid('param').documentId)
          const thread = await service.createThread(actor, context.req.valid('json'))
          return context.json({ thread }, 201)
        })
    )
    .get('/documents/:documentId/threads/:threadId', documentThreadParams, (context) =>
      run(context, async () => {
        const { documentId, threadId } = context.req.valid('param')
        return context.json({ thread: await service.get(await as(context, documentId), threadId) })
      })
    )
    .patch(
      '/documents/:documentId/threads/:threadId',
      documentThreadParams,
      validatedJSON(parseUpdateCommentThread),
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          const actor = await as(context, documentId)
          return context.json({
            thread: await service.updateThread(actor, threadId, context.req.valid('json'))
          })
        })
    )
    .delete('/documents/:documentId/threads/:threadId', documentThreadParams, (context) =>
      run(context, async () => {
        const { documentId, threadId } = context.req.valid('param')
        await service.deleteThread(await as(context, documentId), threadId)
        return context.body(null, 204)
      })
    )
    .post(
      '/documents/:documentId/threads/:threadId/comments',
      documentThreadParams,
      validatedJSON(parseCreateComment),
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          const actor = await as(context, documentId)
          const thread = await service.reply(actor, threadId, context.req.valid('json'))
          return context.json({ thread }, 201)
        })
    )
    .patch(
      '/documents/:documentId/threads/:threadId/comments/:commentId',
      documentCommentParams,
      validatedJSON(parseUpdateComment),
      (context) =>
        run(context, async () => {
          const { documentId, threadId, commentId } = context.req.valid('param')
          const actor = await as(context, documentId)
          return context.json({
            thread: await service.updateComment(
              actor,
              threadId,
              commentId,
              context.req.valid('json')
            )
          })
        })
    )
    .delete(
      '/documents/:documentId/threads/:threadId/comments/:commentId',
      documentCommentParams,
      (context) =>
        run(context, async () => {
          const { documentId, threadId, commentId } = context.req.valid('param')
          const actor = await as(context, documentId)
          return threadOrGone(context, await service.deleteComment(actor, threadId, commentId))
        })
    )
}

/**
 * The same comments through a share link, whose secret every request carries in its body.
 * Guests read; people signed in to the server also write. Reads are POSTs for the same reason.
 */
export function createSharedCommentRoutes(
  service: CommentService,
  resolveSession?: CloudSessionResolver
) {
  async function as(context: Context, shareId: string, secret: string): Promise<CommentActor> {
    return service.forShare(shareId, secret, await shareActor(context.req.raw, resolveSession))
  }
  const run = (context: Context, respond: () => Promise<Response>) =>
    answer(context, respond, sharingDomainError)

  return new Hono()
    .post(
      '/shares/:shareId/threads/list',
      shareParams,
      validatedJSON(parseSharedCommentsRequest),
      (context) =>
        run(context, async () => {
          const { share } = context.req.valid('json')
          const actor = await as(context, context.req.valid('param').shareId, share.secret)
          return context.json(await service.list(actor))
        })
    )
    .post(
      '/shares/:shareId/threads',
      shareParams,
      validatedJSON(parseSharedCreateCommentThread),
      (context) =>
        run(context, async () => {
          const { share, ...input } = context.req.valid('json')
          const actor = await as(context, context.req.valid('param').shareId, share.secret)
          return context.json({ thread: await service.createThread(actor, input) }, 201)
        })
    )
    .post(
      '/shares/:shareId/threads/:threadId/get',
      shareThreadParams,
      validatedJSON(parseSharedCommentsRequest),
      (context) =>
        run(context, async () => {
          const { shareId, threadId } = context.req.valid('param')
          const actor = await as(context, shareId, context.req.valid('json').share.secret)
          return context.json({ thread: await service.get(actor, threadId) })
        })
    )
    .patch(
      '/shares/:shareId/threads/:threadId',
      shareThreadParams,
      validatedJSON(parseSharedUpdateCommentThread),
      (context) =>
        run(context, async () => {
          const { shareId, threadId } = context.req.valid('param')
          const { share, ...input } = context.req.valid('json')
          const actor = await as(context, shareId, share.secret)
          return context.json({ thread: await service.updateThread(actor, threadId, input) })
        })
    )
    .delete(
      '/shares/:shareId/threads/:threadId',
      shareThreadParams,
      validatedJSON(parseSharedCommentsRequest),
      (context) =>
        run(context, async () => {
          const { shareId, threadId } = context.req.valid('param')
          const actor = await as(context, shareId, context.req.valid('json').share.secret)
          await service.deleteThread(actor, threadId)
          return context.body(null, 204)
        })
    )
    .post(
      '/shares/:shareId/threads/:threadId/comments',
      shareThreadParams,
      validatedJSON(parseSharedCreateComment),
      (context) =>
        run(context, async () => {
          const { shareId, threadId } = context.req.valid('param')
          const { share, ...input } = context.req.valid('json')
          const actor = await as(context, shareId, share.secret)
          return context.json({ thread: await service.reply(actor, threadId, input) }, 201)
        })
    )
    .patch(
      '/shares/:shareId/threads/:threadId/comments/:commentId',
      shareCommentParams,
      validatedJSON(parseSharedUpdateComment),
      (context) =>
        run(context, async () => {
          const { shareId, threadId, commentId } = context.req.valid('param')
          const { share, ...input } = context.req.valid('json')
          const actor = await as(context, shareId, share.secret)
          return context.json({
            thread: await service.updateComment(actor, threadId, commentId, input)
          })
        })
    )
    .delete(
      '/shares/:shareId/threads/:threadId/comments/:commentId',
      shareCommentParams,
      validatedJSON(parseSharedCommentsRequest),
      (context) =>
        run(context, async () => {
          const { shareId, threadId, commentId } = context.req.valid('param')
          const actor = await as(context, shareId, context.req.valid('json').share.secret)
          return threadOrGone(context, await service.deleteComment(actor, threadId, commentId))
        })
    )
}

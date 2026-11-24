import {
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
  updateCommentThreadSchema,
  type SharedCommentsRequest
} from '#cloud/contract'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { documentDomainError, type DocumentRouteEnvironment } from '#cloud/server/documents'
import { shareActor } from '#cloud/server/sharing/actor'
import { sharingDomainError } from '#cloud/server/sharing/http'
import { tokenRoute } from '#cloud/server/tokens'
import {
  documentCommentParams,
  documentParams,
  documentThreadParams,
  shareCommentParams,
  shareParams,
  shareThreadParams,
  validatedJSON
} from '#cloud/server/validation'
import { omit } from 'es-toolkit'
import { Hono, type Context } from 'hono'
import type { BlankEnv } from 'hono/types'
import type * as v from 'valibot'

import {
  CommentConflictError,
  CommentLimitError,
  type CommentActor,
  type CommentService
} from './service'

function commentDomainError(context: Context, error: unknown): Response | null {
  if (error instanceof CommentLimitError) {
    return context.json({ error: { code: 'comment_limit_reached' as const } }, 409)
  }
  if (error instanceof CommentConflictError) {
    return context.json({ error: { code: 'comment_conflict' as const } }, 409)
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

/** A route's context once its share, thread, and request body, read by `Schema`, are validated. */
type SharedThreadContext<Schema extends v.GenericSchema> = Context<
  BlankEnv,
  string,
  {
    in: { param: { shareId: string; threadId: string }; json: v.InferInput<Schema> }
    out: { param: { shareId: string; threadId: string }; json: v.InferOutput<Schema> }
  }
>

/** A document's comments for its members and the people it is shared with directly. */
export function createCommentRoutes(service: CommentService) {
  const as = (context: Context<DocumentRouteEnvironment>, documentId: string) =>
    service.forMember(context.get('actor').userId, documentId)
  const run = (context: Context<DocumentRouteEnvironment>, respond: () => Promise<Response>) =>
    answer(context, respond, documentDomainError)

  return new Hono<DocumentRouteEnvironment>()
    .get('/account/notifications', async (context) =>
      context.json(await service.notificationSettings(context.get('actor').userId))
    )
    .put('/account/notifications', validatedJSON(notificationSettingsSchema), async (context) =>
      context.json(
        await service.setNotificationSettings(
          context.get('actor').userId,
          context.req.valid('json')
        )
      )
    )
    .get(
      '/documents/:documentId/threads/people',
      documentParams,
      tokenRoute.read.document,
      (context) =>
        run(context, async () =>
          context.json(
            await service.people(await as(context, context.req.valid('param').documentId))
          )
        )
    )
    .get('/documents/:documentId/threads', documentParams, tokenRoute.read.document, (context) =>
      run(context, async () =>
        context.json(await service.list(await as(context, context.req.valid('param').documentId)))
      )
    )
    .post(
      '/documents/:documentId/threads',
      documentParams,
      tokenRoute.write.document,
      validatedJSON(createCommentThreadSchema),
      (context) =>
        run(context, async () => {
          const actor = await as(context, context.req.valid('param').documentId)
          const thread = await service.createThread(actor, context.req.valid('json'))
          return context.json({ thread }, 201)
        })
    )
    .post(
      '/documents/:documentId/threads/import',
      documentParams,
      tokenRoute.write.document,
      validatedJSON(importCommentThreadsSchema),
      (context) =>
        run(context, async () => {
          const actor = await as(context, context.req.valid('param').documentId)
          return context.json(await service.importThreads(actor, context.req.valid('json')), 201)
        })
    )
    .get(
      '/documents/:documentId/threads/:threadId',
      documentThreadParams,
      tokenRoute.read.document,
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          return context.json({
            thread: await service.get(await as(context, documentId), threadId)
          })
        })
    )
    .post(
      '/documents/:documentId/threads/:threadId/read',
      documentThreadParams,
      tokenRoute.write.document,
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          await service.markRead(await as(context, documentId), threadId)
          return context.body(null, 204)
        })
    )
    .patch(
      '/documents/:documentId/threads/:threadId',
      documentThreadParams,
      tokenRoute.write.document,
      validatedJSON(updateCommentThreadSchema),
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          const actor = await as(context, documentId)
          return context.json({
            thread: await service.updateThread(actor, threadId, context.req.valid('json'))
          })
        })
    )
    .delete(
      '/documents/:documentId/threads/:threadId',
      documentThreadParams,
      tokenRoute.write.document,
      (context) =>
        run(context, async () => {
          const { documentId, threadId } = context.req.valid('param')
          await service.deleteThread(await as(context, documentId), threadId)
          return context.body(null, 204)
        })
    )
    .post(
      '/documents/:documentId/threads/:threadId/comments',
      documentThreadParams,
      tokenRoute.write.document,
      validatedJSON(createCommentSchema),
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
      tokenRoute.write.document,
      validatedJSON(updateCommentSchema),
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
      tokenRoute.write.document,
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
  /** Answers for whoever follows the link, with the secret the request's body carries. */
  async function shared(
    context: Context,
    shareId: string,
    { share }: SharedCommentsRequest,
    respond: (actor: CommentActor) => Promise<Response>
  ): Promise<Response> {
    return answer(
      context,
      async () =>
        respond(
          await service.forShare(
            shareId,
            share.secret,
            await shareActor(context.req.raw, resolveSession)
          )
        ),
      sharingDomainError
    )
  }

  /** A route that acts on a shared thread for whoever opened the share, answering with no content. */
  function sharedThreadAction(act: (actor: CommentActor, threadId: string) => Promise<void>) {
    return (context: SharedThreadContext<typeof sharedCommentsRequestSchema>) => {
      const { shareId, threadId } = context.req.valid('param')
      return shared(context, shareId, context.req.valid('json'), async (actor) => {
        await act(actor, threadId)
        return context.body(null, 204)
      })
    }
  }

  /**
   * A route that changes a shared thread with the edit its request carries, for whoever opened the
   * share, answering with the thread.
   */
  function sharedThreadChange<Schema extends v.GenericSchema<unknown, SharedCommentsRequest>>(
    change: (
      actor: CommentActor,
      threadId: string,
      edit: Omit<v.InferOutput<Schema>, 'share'>
    ) => Promise<unknown>,
    status: 200 | 201 = 200
  ) {
    return (context: SharedThreadContext<Schema>) => {
      const { shareId, threadId } = context.req.valid('param')
      const request = context.req.valid('json')
      return shared(context, shareId, request, async (actor) =>
        context.json({ thread: await change(actor, threadId, omit(request, ['share'])) }, status)
      )
    }
  }

  return new Hono()
    .post(
      '/shares/:shareId/threads/list',
      shareParams,
      validatedJSON(sharedCommentsRequestSchema),
      (context) =>
        shared(
          context,
          context.req.valid('param').shareId,
          context.req.valid('json'),
          async (actor) => context.json(await service.list(actor))
        )
    )
    .post(
      '/shares/:shareId/threads',
      shareParams,
      validatedJSON(sharedCreateCommentThreadSchema),
      (context) => {
        const { share, ...input } = context.req.valid('json')
        return shared(context, context.req.valid('param').shareId, { share }, async (actor) =>
          context.json({ thread: await service.createThread(actor, input) }, 201)
        )
      }
    )
    .post(
      '/shares/:shareId/threads/:threadId/get',
      shareThreadParams,
      validatedJSON(sharedCommentsRequestSchema),
      (context) => {
        const { shareId, threadId } = context.req.valid('param')
        return shared(context, shareId, context.req.valid('json'), async (actor) =>
          context.json({ thread: await service.get(actor, threadId) })
        )
      }
    )
    .post(
      '/shares/:shareId/threads/:threadId/read',
      shareThreadParams,
      validatedJSON(sharedCommentsRequestSchema),
      sharedThreadAction((actor, threadId) => service.markRead(actor, threadId))
    )
    .patch(
      '/shares/:shareId/threads/:threadId',
      shareThreadParams,
      validatedJSON(sharedUpdateCommentThreadSchema),
      sharedThreadChange<typeof sharedUpdateCommentThreadSchema>((actor, threadId, edit) =>
        service.updateThread(actor, threadId, edit)
      )
    )
    .delete(
      '/shares/:shareId/threads/:threadId',
      shareThreadParams,
      validatedJSON(sharedCommentsRequestSchema),
      sharedThreadAction((actor, threadId) => service.deleteThread(actor, threadId))
    )
    .post(
      '/shares/:shareId/threads/:threadId/comments',
      shareThreadParams,
      validatedJSON(sharedCreateCommentSchema),
      sharedThreadChange<typeof sharedCreateCommentSchema>(
        (actor, threadId, comment) => service.reply(actor, threadId, comment),
        201
      )
    )
    .patch(
      '/shares/:shareId/threads/:threadId/comments/:commentId',
      shareCommentParams,
      validatedJSON(sharedUpdateCommentSchema),
      (context) => {
        const { shareId, threadId, commentId } = context.req.valid('param')
        const { share, ...input } = context.req.valid('json')
        return shared(context, shareId, { share }, async (actor) =>
          context.json({ thread: await service.updateComment(actor, threadId, commentId, input) })
        )
      }
    )
    .delete(
      '/shares/:shareId/threads/:threadId/comments/:commentId',
      shareCommentParams,
      validatedJSON(sharedCommentsRequestSchema),
      (context) => {
        const { shareId, threadId, commentId } = context.req.valid('param')
        return shared(context, shareId, context.req.valid('json'), async (actor) =>
          threadOrGone(context, await service.deleteComment(actor, threadId, commentId))
        )
      }
    )
}

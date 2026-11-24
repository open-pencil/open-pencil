import { AdminDomainError } from '#cloud/admin/errors'
import { isUUID } from '#cloud/admin/schema'
import { adminContract, type CloudAPIErrorCode } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { ORPCError } from '@orpc/client'
import { implement } from '@orpc/server'
import { NoResultError } from 'kysely'
import * as v from 'valibot'

import type { CloudAdminServices } from './routes'

/** The code an administration error answers with, or null for any other error. */
function adminErrorCode(error: unknown): CloudAPIErrorCode | null {
  if (error instanceof AdminDomainError) return error.code
  if (error instanceof v.ValiError) return 'invalid_request'
  // An enrollment or message ID that names nothing, or a document with nothing saved.
  if (error instanceof NoResultError || error instanceof DocumentNotFoundError) return 'not_found'
  return null
}

async function adminErrors<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next()
  } catch (error) {
    const code = adminErrorCode(error)
    if (code) throw new ORPCError(code, { cause: error })
    throw error
  }
}

/** What an administration route knows of its request: the administrator, and the request. */
export type AdminProcedureContext = { actor: CloudActor; request: Request }

/** The server's administration, as the contract describes it, for its administrators. */
export function createAdminProcedures(services: CloudAdminServices) {
  const routes = implement(adminContract).$context<AdminProcedureContext>().use(adminErrors)
  const ok = { ok: true as const }

  /** Does what an administrator asked to another account; one that is not an account is not found. */
  async function onAccount(
    actor: CloudActor,
    userId: string,
    mutate: (actorId: string, userId: string) => Promise<void>
  ) {
    if (!isUUID(userId)) throw new ORPCError('not_found')
    // A UUID matches in any case; the lowercase spelling is the one the actor's own ID uses.
    await mutate(actor.userId, userId.toLowerCase())
    return ok
  }

  const review =
    (status: 'approved' | 'rejected' | 'revoked') =>
    async ({
      context,
      input
    }: {
      context: AdminProcedureContext
      input: { params: { id: string }; body: { note?: string } }
    }) => ({
      enrollment: await services.enrollment.review(
        context.actor.userId,
        input.params.id,
        status,
        input.body
      )
    })

  return routes.router({
    enrollments: routes.enrollments.handler(({ input }) => services.enrollment.list(input.query)),
    approveEnrollment: routes.approveEnrollment.handler(review('approved')),
    rejectEnrollment: routes.rejectEnrollment.handler(review('rejected')),
    revokeEnrollment: routes.revokeEnrollment.handler(review('revoked')),
    users: routes.users.handler(({ input }) => services.users.list(input.query)),
    user: routes.user.handler(async ({ input, errors }) => {
      const detail = await services.users.detail(input.params.id)
      if (!detail) throw errors.not_found()
      return detail
    }),
    resetTwoStep: routes.resetTwoStep.handler(({ context, input }) =>
      onAccount(context.actor, input.body.userId, (actorId, userId) =>
        services.users.resetTwoStep(actorId, userId)
      )
    ),
    removeSignInMethod: routes.removeSignInMethod.handler(({ context, input }) =>
      onAccount(context.actor, input.body.userId, (actorId, userId) =>
        services.users.removeSignInMethod(actorId, userId, input.body.methodId)
      )
    ),
    removePicture: routes.removePicture.handler(({ context, input }) =>
      onAccount(context.actor, input.body.userId, (actorId, userId) =>
        services.users.removePicture(actorId, userId)
      )
    ),
    deleteUser: routes.deleteUser.handler(({ context, input }) =>
      onAccount(context.actor, input.body.userId, (actorId, userId) =>
        services.users.deleteUnapproved(actorId, userId)
      )
    ),
    ban: routes.ban.handler(async ({ context, input }) => {
      await services.users.ban(
        context.request.headers,
        context.actor.userId,
        input.body.userId,
        input.body.reason
      )
      return ok
    }),
    unban: routes.unban.handler(async ({ context, input }) => {
      await services.users.unban(context.request.headers, context.actor.userId, input.body.userId)
      return ok
    }),
    revokeSessions: routes.revokeSessions.handler(async ({ context, input }) => {
      await services.users.revokeSessions(
        context.request.headers,
        context.actor.userId,
        input.body.userId
      )
      return ok
    }),
    setAdmin: routes.setAdmin.handler(async ({ context, input }) => {
      await services.users.setAdmin(
        context.request.headers,
        context.actor.userId,
        input.body.userId,
        input.body.enabled
      )
      return ok
    }),
    email: routes.email.handler(({ input }) => services.email.list(input.query)),
    regenerateEmail: routes.regenerateEmail.handler(async ({ context, input }) => {
      await services.email.regenerate(context.actor.userId, input.params.id)
      return ok
    }),
    audit: routes.audit.handler(({ input }) => services.audit.list(input.query)),
    operations: routes.operations.handler(() => services.operations.summary()),
    reports: routes.reports.handler(({ input }) => services.reports.list(input.query)),
    dismissReport: routes.dismissReport.handler(async ({ context, input }) => {
      await services.reports.resolve(context.actor.userId, input.params.id, 'dismissed')
      return ok
    }),
    actionReport: routes.actionReport.handler(async ({ context, input }) => {
      await services.reports.resolve(context.actor.userId, input.params.id, 'actioned')
      return ok
    }),
    documents: routes.documents.handler(({ input }) => services.documents.list(input.query)),
    disableDocument: routes.disableDocument.handler(async ({ context, input }) => {
      await services.documents.disable(context.actor.userId, input.params.id, input.body.reason)
      return ok
    }),
    enableDocument: routes.enableDocument.handler(async ({ context, input }) => {
      await services.documents.enable(context.actor.userId, input.params.id)
      return ok
    }),
    undeleteDocument: routes.undeleteDocument.handler(async ({ context, input }) => {
      await services.documents.undelete(context.actor.userId, input.params.id)
      return ok
    }),
    downloadDocument: routes.downloadDocument.handler(({ context, input }) =>
      services.documents.download(context.actor.userId, input.params.id)
    ),
    revokeShare: routes.revokeShare.handler(async ({ context, input }) => {
      await services.documents.revokeShare(context.actor.userId, input.params.id)
      return ok
    })
  })
}

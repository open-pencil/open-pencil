import { sessionContract, workspacesContract, type CloudAPIErrorCode } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { BillingTokenService } from '#cloud/server/billing'
import { DocumentNotFoundError } from '#cloud/server/documents'
import { InvitationLimitError } from '#cloud/server/invitations'
import type { EntitlementService } from '#cloud/server/policy'
import { ServicesNotEntitledError, type ServicesTokenService } from '#cloud/server/services'
import { ORPCError } from '@orpc/client'
import { implement } from '@orpc/server'

import {
  WorkspaceAlreadyMemberError,
  WorkspaceForbiddenError,
  WorkspaceLastAdminError,
  WorkspaceNotEmptyError,
  WorkspaceNotFoundError,
  type WorkspaceMemberService
} from './members'
import { WorkspaceSlugConflictError, type WorkspaceService } from './service'

/** The code a workspace domain error answers with, or null for any other error. */
function workspaceErrorCode(error: unknown): CloudAPIErrorCode | null {
  // A workspace the account left, or one that has gone, since the editor listed it.
  if (error instanceof WorkspaceNotFoundError || error instanceof DocumentNotFoundError) {
    return 'not_found'
  }
  if (error instanceof WorkspaceForbiddenError) return 'forbidden'
  if (error instanceof ServicesNotEntitledError) return 'forbidden'
  if (error instanceof WorkspaceLastAdminError) return 'last_admin'
  if (error instanceof WorkspaceNotEmptyError) {
    return error.reason === 'documents' ? 'not_empty' : 'cleanup_pending'
  }
  if (error instanceof WorkspaceAlreadyMemberError) return 'already_member'
  if (error instanceof WorkspaceSlugConflictError) return 'slug_conflict'
  if (error instanceof InvitationLimitError) return 'rate_limited'
  return null
}

async function workspaceErrors<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next()
  } catch (error) {
    const code = workspaceErrorCode(error)
    if (code) throw new ORPCError(code, { cause: error })
    throw error
  }
}

/** Workspaces and their members, as the contract describes them, for the signed-in actor. */
export function createWorkspaceProcedures(services: {
  workspaces: WorkspaceService
  members: WorkspaceMemberService
  entitlements?: EntitlementService
}) {
  const { workspaces, members, entitlements } = services
  const routes = implement(workspacesContract)
    .$context<{ actor: CloudActor }>()
    .use(workspaceErrors)
  return routes.router({
    list: routes.list.handler(async ({ context }) => ({
      workspaces: await workspaces.list(context.actor.userId)
    })),
    create: routes.create.handler(async ({ context, input }) => ({
      workspace: await workspaces.create(context.actor.userId, input.body)
    })),
    get: routes.get.handler(async ({ context, input, errors }) => {
      const workspace = await workspaces.get(context.actor.userId, input.params.workspaceId)
      if (!workspace) throw errors.not_found()
      return { workspace }
    }),
    rename: routes.rename.handler(async ({ context, input }) => ({
      workspace: await members.rename(
        context.actor.userId,
        input.params.workspaceId,
        input.body.name
      )
    })),
    remove: routes.remove.handler(async ({ context, input }) => {
      await members.delete(context.actor.userId, input.params.workspaceId)
    }),
    members: routes.members.handler(({ context, input }) =>
      members.list(context.actor.userId, input.params.workspaceId)
    ),
    invite: routes.invite.handler(({ context, input }) =>
      members.invite(context.actor.userId, input.params.workspaceId, input.body)
    ),
    resendInvitation: routes.resendInvitation.handler(({ context, input }) =>
      members.resendInvitation(
        context.actor.userId,
        input.params.workspaceId,
        input.params.invitationId
      )
    ),
    revokeInvitation: routes.revokeInvitation.handler(async ({ context, input }) => {
      await members.revokeInvitation(
        context.actor.userId,
        input.params.workspaceId,
        input.params.invitationId
      )
    }),
    updateMember: routes.updateMember.handler(async ({ context, input }) => {
      await members.updateRole(
        context.actor.userId,
        input.params.workspaceId,
        input.params.userId,
        input.body.role
      )
    }),
    removeMember: routes.removeMember.handler(async ({ context, input }) => {
      await members.remove(context.actor.userId, input.params.workspaceId, input.params.userId)
    }),
    entitlements: routes.entitlements.handler(async ({ context, input, errors }) => {
      if (!entitlements) throw errors.not_found()
      return {
        entitlements: await entitlements.workspace(context.actor.userId, input.params.workspaceId)
      }
    })
  })
}

/**
 * The signed-in session, the account's plan, and tokens for the deployment's services and
 * billing; a deployment without one of those answers its token route as not found.
 */
export function createSessionProcedures(services: {
  entitlements?: EntitlementService
  servicesTokens?: ServicesTokenService
  billingTokens?: BillingTokenService
}) {
  const { entitlements, servicesTokens, billingTokens } = services
  const routes = implement(sessionContract).$context<{ actor: CloudActor }>().use(workspaceErrors)
  return routes.router({
    session: routes.session.handler(({ context }) => ({ user: context.actor })),
    accountEntitlements: routes.accountEntitlements.handler(async ({ context, errors }) => {
      if (!entitlements) throw errors.not_found()
      return { entitlements: await entitlements.account(context.actor.userId) }
    }),
    servicesToken: routes.servicesToken.handler(({ context, input, errors }) => {
      if (!servicesTokens) throw errors.not_found()
      return servicesTokens.issue(context.actor, input.body.workspaceId)
    }),
    billingToken: routes.billingToken.handler(({ context, errors }) => {
      if (!billingTokens) throw errors.not_found()
      return billingTokens.issue(context.actor)
    })
  })
}

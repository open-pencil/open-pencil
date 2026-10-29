import {
  parseCreateWorkspace,
  parseCreateWorkspaceInvitation,
  parseUpdateWorkspace,
  parseUpdateWorkspaceMember
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON } from '#cloud/server/validation'
import {
  WorkspaceAlreadyMemberError,
  WorkspaceForbiddenError,
  WorkspaceLastAdminError,
  WorkspaceNotEmptyError,
  WorkspaceNotFoundError,
  type WorkspaceMemberService
} from '#cloud/server/workspaces/members'
import type { WorkspaceService } from '#cloud/server/workspaces/service'
import { WorkspaceSlugConflictError } from '#cloud/server/workspaces/service'
import { Hono, type Context } from 'hono'
import type { Kysely } from 'kysely'

export type WorkspaceRouteEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

/** Runs a membership action, answering its domain errors with their HTTP codes. */
async function memberRoute<T>(context: Context, action: () => Promise<T>): Promise<T | Response> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return context.json({ error: { code: 'not_found' as const } }, 404)
    }
    if (error instanceof WorkspaceForbiddenError) {
      return context.json({ error: { code: 'forbidden' as const } }, 403)
    }
    if (error instanceof WorkspaceLastAdminError) {
      return context.json({ error: { code: 'last_admin' as const } }, 409)
    }
    if (error instanceof WorkspaceNotEmptyError) {
      const code = error.reason === 'documents' ? 'not_empty' : 'cleanup_pending'
      return context.json({ error: { code } }, 409)
    }
    if (error instanceof WorkspaceAlreadyMemberError) {
      return context.json({ error: { code: 'already_member' as const } }, 409)
    }
    throw error
  }
}

export function createWorkspaceRoutes(
  service: WorkspaceService,
  members: WorkspaceMemberService,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<WorkspaceRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.workspaceCreation,
        (context) => context.req.method !== 'POST'
      )
    )
    // Resending mails the invitation again, so it counts against the same budget as sending.
    router.use(
      '/:workspaceId/invitations/:invitationId/resend',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        () => false,
        (context) => context.req.param('workspaceId') ?? 'unknown'
      )
    )
    router.use(
      '/:workspaceId/invitations',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('workspaceId') ?? 'unknown'
      )
    )
  }
  return router
    .get('/', async (context) => {
      const workspaces = await service.list(context.get('actor').userId)
      return context.json({ workspaces })
    })
    .post('/', validatedJSON(parseCreateWorkspace), async (context) => {
      try {
        const workspace = await service.create(
          context.get('actor').userId,
          context.req.valid('json')
        )
        return context.json({ workspace }, 201)
      } catch (error) {
        if (error instanceof WorkspaceSlugConflictError) {
          return context.json({ error: { code: 'slug_conflict' as const } }, 409)
        }
        throw error
      }
    })
    .get('/:workspaceId', async (context) => {
      const workspace = await service.get(
        context.get('actor').userId,
        context.req.param('workspaceId')
      )
      if (!workspace) return context.json({ error: { code: 'not_found' as const } }, 404)
      return context.json({ workspace })
    })
    .patch('/:workspaceId', validatedJSON(parseUpdateWorkspace), (context) =>
      memberRoute(context, async () =>
        context.json({
          workspace: await members.rename(
            context.get('actor').userId,
            context.req.param('workspaceId'),
            context.req.valid('json').name
          )
        })
      )
    )
    .delete('/:workspaceId', (context) =>
      memberRoute(context, async () => {
        await members.delete(context.get('actor').userId, context.req.param('workspaceId'))
        return context.body(null, 204)
      })
    )
    .get('/:workspaceId/members', (context) =>
      memberRoute(context, async () =>
        context.json(
          await members.list(context.get('actor').userId, context.req.param('workspaceId'))
        )
      )
    )
    .post('/:workspaceId/invitations', validatedJSON(parseCreateWorkspaceInvitation), (context) =>
      memberRoute(context, async () =>
        context.json(
          await members.invite(
            context.get('actor').userId,
            context.req.param('workspaceId'),
            context.req.valid('json')
          ),
          201
        )
      )
    )
    .post('/:workspaceId/invitations/:invitationId/resend', (context) =>
      memberRoute(context, async () =>
        context.json(
          await members.resendInvitation(
            context.get('actor').userId,
            context.req.param('workspaceId'),
            context.req.param('invitationId')
          )
        )
      )
    )
    .delete('/:workspaceId/invitations/:invitationId', (context) =>
      memberRoute(context, async () => {
        await members.revokeInvitation(
          context.get('actor').userId,
          context.req.param('workspaceId'),
          context.req.param('invitationId')
        )
        return context.body(null, 204)
      })
    )
    .patch('/:workspaceId/members/:userId', validatedJSON(parseUpdateWorkspaceMember), (context) =>
      memberRoute(context, async () => {
        await members.updateRole(
          context.get('actor').userId,
          context.req.param('workspaceId'),
          context.req.param('userId'),
          context.req.valid('json').role
        )
        return context.body(null, 204)
      })
    )
    .delete('/:workspaceId/members/:userId', (context) =>
      memberRoute(context, async () => {
        await members.remove(
          context.get('actor').userId,
          context.req.param('workspaceId'),
          context.req.param('userId')
        )
        return context.body(null, 204)
      })
    )
}

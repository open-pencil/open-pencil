import { parseCreateWorkspace } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { WorkspaceService } from '#cloud/server/workspaces/service'
import { WorkspaceSlugConflictError } from '#cloud/server/workspaces/service'
import { Hono } from 'hono'
import { ValiError } from 'valibot'

export type WorkspaceRouteEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

export function createWorkspaceRoutes(service: WorkspaceService) {
  return new Hono<WorkspaceRouteEnvironment>()
    .get('/', async (context) => {
      const workspaces = await service.list(context.get('actor').userId)
      return context.json({ workspaces })
    })
    .post('/', async (context) => {
      try {
        const input = parseCreateWorkspace(await context.req.json())
        const workspace = await service.create(context.get('actor').userId, input)
        return context.json({ workspace }, 201)
      } catch (error) {
        if (error instanceof ValiError) {
          return context.json({ error: { code: 'invalid_request' as const } }, 400)
        }
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
}

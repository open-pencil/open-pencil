import { parseCreateWorkspace } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { validatedJSON } from '#cloud/server/validation'
import type { WorkspaceService } from '#cloud/server/workspaces/service'
import { WorkspaceSlugConflictError } from '#cloud/server/workspaces/service'
import { Hono } from 'hono'

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
}

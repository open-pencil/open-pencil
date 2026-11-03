import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import {
  createActorRateLimiter,
  createRouteRateLimiter,
  routeHasOwnBudget,
  routeParamResource
} from '#cloud/server/rate-limit'
import { Hono } from 'hono'

const SECRET = 'a rate limit secret'
const policy = (namespace: string, limit: number) => ({ namespace, windowMs: 60_000, limit })

describe('rate limit budgets', () => {
  test("leaves a route's own requests to its own budget", async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const routes = new Hono<CloudAPIEnvironment>()
        .use(
          '/documents',
          createRouteRateLimiter(
            runtime.database,
            SECRET,
            policy('documents', 3),
            (context) => context.req.method !== 'POST'
          )
        )
        .post('/documents', (context) => context.text('created'))
        .delete('/documents', (context) => context.text('deleted'))
        .post('/rename', (context) => context.text('renamed'))
      const app = new Hono<CloudAPIEnvironment>()
        .use('/*', async (context, next) => {
          context.set('actor', { userId: 'ada', email: 'ada@example.com', name: 'Ada' })
          await next()
        })
        .use(
          '/*',
          createActorRateLimiter(runtime.database, SECRET, policy('general', 1), (context) =>
            routeHasOwnBudget(context)
          )
        )
        .route('/', routes)
      const status = async (method: string, path: string) =>
        (await app.request(path, { method })).status

      // Three creations fit the route's own budget, though the general one allows a single request.
      for (const _ of [1, 2, 3]) expect(await status('POST', '/documents')).toBe(200)
      expect(await status('POST', '/documents')).toBe(429)
      // A request the route's limiter does not count is the general limiter's.
      expect(await status('DELETE', '/documents')).toBe(200)
      expect(await status('POST', '/rename')).toBe(429)
    } finally {
      await runtime.close()
    }
  })

  test('counts every invitation of a workspace on one budget, whichever invitation a path names', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const app = new Hono<CloudAPIEnvironment>()
        .use('/*', async (context, next) => {
          context.set('actor', { userId: 'ada', email: 'ada@example.com', name: 'Ada' })
          await next()
        })
        .use(
          '/workspaces/:workspaceId/invitations/:invitationId/resend',
          createRouteRateLimiter(
            runtime.database,
            SECRET,
            policy('resends', 2),
            undefined,
            routeParamResource('workspaceId')
          )
        )
        .post('/workspaces/:workspaceId/invitations/:invitationId/resend', (context) =>
          context.text('sent')
        )
      const resend = async (workspace: string, invitation: string) =>
        (
          await app.request(`/workspaces/${workspace}/invitations/${invitation}/resend`, {
            method: 'POST'
          })
        ).status

      // Each resend names a new invitation, so a budget per path would never run out.
      expect(await resend('w1', 'i1')).toBe(200)
      expect(await resend('w1', 'i2')).toBe(200)
      expect(await resend('w1', 'i3')).toBe(429)
      expect(await resend('w2', 'i4')).toBe(200)
    } finally {
      await runtime.close()
    }
  })
})

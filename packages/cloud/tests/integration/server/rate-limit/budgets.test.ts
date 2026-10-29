import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import {
  createActorRateLimiter,
  createRouteRateLimiter,
  routeHasOwnBudget
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
})

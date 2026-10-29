import { pingSchema } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { rateLimited, validatedJSON } from '#feedback/http/request'
import { Hono } from 'hono'

import { recordPing } from './record'

export function pingRoutes(services: FeedbackServices) {
  return new Hono<FeedbackEnv>().post(
    '/ping',
    rateLimited((env) => env.PING_LIMITER),
    validatedJSON(pingSchema),
    async (c) => {
      await recordPing(createFeedbackDatabase(c.env.DB), c.req.valid('json'), services.now())
      return c.body(null, 204)
    }
  )
}

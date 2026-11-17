import { CAMPAIGNS } from '#feedback/campaigns/catalog'
import { pingSchema, type PingAnswer } from '#feedback/contract'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { rateLimited, validatedJSON } from '#feedback/http/request'
import { Hono } from 'hono'

import { recordPing, requestNetwork } from './record'

export function pingRoutes(services: FeedbackServices) {
  return new Hono<FeedbackEnv>().post(
    '/ping',
    rateLimited((env) => env.PING_LIMITER),
    validatedJSON(pingSchema),
    async (c) => {
      await recordPing(c.env.DB, c.req.valid('json'), requestNetwork(c.req.raw), services.now())
      // Builds before campaigns read no answer, so they are sent to every ping.
      const answer: PingAnswer = { campaigns: [...(services.campaigns ?? CAMPAIGNS)] }
      return c.json(answer, 200)
    }
  )
}

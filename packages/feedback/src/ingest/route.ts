import { CAMPAIGNS } from '#feedback/campaigns/catalog'
import { usageBatchSchema } from '#feedback/contract'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { rateLimited, validatedJSON } from '#feedback/http/request'
import { Hono } from 'hono'

import { toPostHogBatch } from './posthog'

/** Forwards a valid usage batch to PostHog and stores nothing; anything off the event list is refused. */
export function ingestRoutes(services: FeedbackServices) {
  return new Hono<FeedbackEnv>().post(
    '/ingest',
    rateLimited((env) => env.INGEST_LIMITER),
    validatedJSON(usageBatchSchema),
    async (c) => {
      const batch = toPostHogBatch(
        c.req.valid('json'),
        c.env.POSTHOG_KEY,
        services.campaigns ?? CAMPAIGNS
      )
      // A batch of only retired campaigns' events leaves nothing to send.
      if (batch.batch.length === 0) return c.body(null, 204)
      const response = await services
        .fetch(`${c.env.POSTHOG_HOST}/batch/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch)
        })
        .catch(() => null)
      return c.body(null, response?.ok ? 204 : 502)
    }
  )
}

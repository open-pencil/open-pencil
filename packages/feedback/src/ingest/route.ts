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
      const response = await services
        .fetch(`${c.env.POSTHOG_HOST}/batch/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPostHogBatch(c.req.valid('json'), c.env.POSTHOG_KEY))
        })
        .catch(() => null)
      return c.body(null, response?.ok ? 204 : 502)
    }
  )
}

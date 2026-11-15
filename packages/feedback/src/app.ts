import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { adminRoutes } from './admin/route'
import type { FeedbackEnv, FeedbackServices } from './env'
import { allowOpenPencilOrigins } from './http/cors'
import { ingestRoutes } from './ingest/route'
import { pingRoutes } from './ping/route'
import { reportRoutes } from './reports/route'
import { waitlistRoutes } from './waitlist/route'

export type { FeedbackBindings, FeedbackEnv, FeedbackServices } from './env'

const MAX_BODY_BYTES = 16 * 1024
const limitBody = bodyLimit({ maxSize: MAX_BODY_BYTES })

/** The real outside world; tests pass their own. */
export const defaultServices: FeedbackServices = {
  fetch: (input, init) => fetch(input, init),
  now: () => new Date()
}

export function createFeedbackApp(services: FeedbackServices = defaultServices) {
  return (
    new Hono<FeedbackEnv>()
      .use('*', allowOpenPencilOrigins)
      // Reports set their own limits: a report's body is larger, and an attached file far larger.
      .use('*', (c, next) => (c.req.path.startsWith('/reports') ? next() : limitBody(c, next)))
      .route('/', pingRoutes(services))
      .route('/', reportRoutes(services))
      .route('/', ingestRoutes(services))
      .route('/', waitlistRoutes(services))
      .route('/', adminRoutes(services))
  )
}

/** The service's routes and request bodies, for `hc<FeedbackAPI>` clients. */
export type FeedbackAPI = ReturnType<typeof createFeedbackApp>

import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { adminRoutes } from './admin/route'
import type { FeedbackEnv, FeedbackServices } from './env'
import { allowOpenPencilOrigins } from './http/cors'
import { ingestRoutes } from './ingest/route'
import { pingRoutes } from './ping/route'
import { waitlistRoutes } from './waitlist/route'

export type { FeedbackBindings, FeedbackEnv, FeedbackServices } from './env'

const MAX_BODY_BYTES = 16 * 1024

/** The real outside world; tests pass their own. */
export const defaultServices: FeedbackServices = {
  fetch: (input, init) => fetch(input, init),
  now: () => new Date()
}

export function createFeedbackApp(services: FeedbackServices = defaultServices) {
  return new Hono<FeedbackEnv>()
    .use('*', allowOpenPencilOrigins)
    .use('*', bodyLimit({ maxSize: MAX_BODY_BYTES }))
    .route('/', pingRoutes(services))
    .route('/', ingestRoutes(services))
    .route('/', waitlistRoutes(services))
    .route('/', adminRoutes(services))
}

/** The service's routes and request bodies, for `hc<FeedbackAPI>` clients. */
export type FeedbackAPI = ReturnType<typeof createFeedbackApp>

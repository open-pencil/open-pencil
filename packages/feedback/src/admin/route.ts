import { metricsQuerySchema } from '#feedback/contract'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { validatedQuery } from '#feedback/http/request'
import { Hono } from 'hono'

import { requireAccess } from './access'
import { buildSnapshot } from './snapshot'

/**
 * The metrics dashboard's page and API, behind Cloudflare Access. Answers are for one signed-in
 * person, so nothing between here and the browser may keep a copy.
 */
export function adminRoutes(services: FeedbackServices) {
  const access = requireAccess(services)
  return (
    new Hono<FeedbackEnv>()
      .use('/admin', access)
      .use('/admin/*', access)
      .get('/admin/api/snapshot', validatedQuery(metricsQuerySchema), async (c) => {
        c.header('Cache-Control', 'private, no-store')
        return c.json(await buildSnapshot(c.env, services, c.req.valid('query')), 200)
      })
      .get('/admin', (c) => c.redirect('/admin/'))
      // The page and its files, from the Worker's static assets once Access has let the request in.
      .get('/admin/*', async (c) => {
        const url = new URL(c.req.url)
        // Vite names the page after its source, `metrics.html`.
        if (url.pathname === '/admin/') url.pathname = '/admin/metrics.html'
        // By URL alone: the page must never come back as a 304 for a cached copy.
        const asset = await c.env.ASSETS.fetch(url.toString())
        if (!asset.ok) return c.notFound()
        // The binding answers with the Workers runtime's own Response type, so its bytes and
        // type are copied into Hono's.
        return c.body(await asset.arrayBuffer(), 200, {
          'Content-Type': asset.headers.get('content-type') ?? 'application/octet-stream',
          'Cache-Control': 'private, no-store'
        })
      })
  )
}

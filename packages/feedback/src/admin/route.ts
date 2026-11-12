import {
  metricsQuerySchema,
  reportFileNameSchema,
  reportInboxQuerySchema,
  reportTriageSchema
} from '#feedback/contract'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { validatedJSON, validatedQuery } from '#feedback/http/request'
import { reportFileKey, reportFileThumbnail } from '#feedback/reports/files'
import { Hono } from 'hono'
import * as v from 'valibot'

import { requireAccess } from './access'
import { fetchReportDetail, fetchReportInbox, saveReportTriage } from './reports'
import { buildSnapshot } from './snapshot'

const reportParamsSchema = v.object({ reportId: v.pipe(v.string(), v.uuid()) })

const reportFileParamsSchema = v.object({
  reportId: v.pipe(v.string(), v.uuid()),
  name: reportFileNameSchema
})

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
      // The report inbox: one page of reports from PostHog with the team's triage.
      .get('/admin/api/reports', validatedQuery(reportInboxQuerySchema), async (c) => {
        c.header('Cache-Control', 'private, no-store')
        return c.json(await fetchReportInbox(c.env, services, c.req.valid('query')), 200)
      })
      .get('/admin/api/reports/:reportId', async (c) => {
        const params = v.safeParse(reportParamsSchema, c.req.param())
        if (!params.success) return c.body(null, 404)
        const report = await fetchReportDetail(c.env, services, params.output.reportId)
        if (!report) return c.body(null, 404)
        c.header('Cache-Control', 'private, no-store')
        return c.json(report, 200)
      })
      .put('/admin/api/reports/:reportId/triage', validatedJSON(reportTriageSchema), async (c) => {
        const params = v.safeParse(reportParamsSchema, c.req.param())
        if (!params.success) return c.body(null, 404)
        const saved = await saveReportTriage(
          c.env,
          services,
          params.output.reportId,
          c.req.valid('json'),
          c.get('adminEmail') ?? 'unknown'
        )
        c.header('Cache-Control', 'private, no-store')
        return c.json(saved, 200)
      })
      // An attached document's own thumbnail, read from the file in ranges, for the inbox to show.
      .get('/admin/reports/:reportId/files/:name/thumbnail', async (c) => {
        const params = v.safeParse(reportFileParamsSchema, c.req.param())
        if (!params.success) return c.notFound()
        const { reportId, name } = params.output
        const png = await reportFileThumbnail(c.env.REPORTS, reportFileKey(reportId, name))
        if (!png) return c.notFound()
        return c.body(png.slice().buffer, 200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, no-store'
        })
      })
      // A file attached to a report, linked from its PostHog event; always a download, never rendered.
      .get('/admin/reports/:reportId/files/:name', async (c) => {
        const params = v.safeParse(reportFileParamsSchema, c.req.param())
        if (!params.success) return c.notFound()
        const { reportId, name } = params.output
        const object = await c.env.REPORTS.get(reportFileKey(reportId, name))
        if (!object) return c.notFound()
        return c.body(await object.arrayBuffer(), 200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${reportId}-${name}"`,
          'Cache-Control': 'private, no-store'
        })
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

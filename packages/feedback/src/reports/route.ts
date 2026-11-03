import {
  REPORT_BODY_MAX_BYTES,
  reportFileNameSchema,
  reportSchema,
  type ReportReceipt
} from '#feedback/contract'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { rateLimited, validatedJSON } from '#feedback/http/request'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import * as v from 'valibot'

import { reportFileKey } from './files'
import { toPostHogReport } from './posthog'
import { allowedUpload, signUploadToken } from './upload'

const uploadParamsSchema = v.object({
  reportId: v.pipe(v.string(), v.uuid()),
  name: reportFileNameSchema
})

/**
 * Error and problem reports a person chose to send. The report goes to PostHog as it arrives and
 * nothing of it is stored here; files it declared are uploaded next, one request each, with the
 * token the answer carries, and kept in R2 until retention deletes them.
 */
export function reportRoutes(services: FeedbackServices) {
  const limited = rateLimited((env) => env.REPORT_LIMITER)
  return new Hono<FeedbackEnv>()
    .post(
      '/reports',
      bodyLimit({ maxSize: REPORT_BODY_MAX_BYTES }),
      limited,
      validatedJSON(reportSchema),
      async (c) => {
        const report = c.req.valid('json')
        const reportId = crypto.randomUUID()
        const now = services.now()
        // Signed first, so a failure here stops the report before PostHog receives it.
        const files = report.files ?? []
        const receipt: ReportReceipt = {
          reportId,
          uploadToken:
            files.length > 0
              ? await signUploadToken(c.env.REPORT_UPLOAD_SECRET, reportId, files, now)
              : null
        }
        const body = toPostHogReport(report, {
          apiKey: c.env.POSTHOG_KEY,
          reportId,
          origin: new URL(c.req.url).origin,
          timestamp: now.toISOString()
        })
        const response = await services
          .fetch(`${c.env.POSTHOG_HOST}/batch/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          .catch(() => null)
        if (!response?.ok) return c.body(null, 502)
        return c.json(receipt, 201)
      }
    )
    .put('/reports/:reportId/files/:name', limited, async (c) => {
      const params = v.safeParse(uploadParamsSchema, c.req.param())
      const token = c.req.header('authorization')?.match(/^Bearer (\S+)$/)?.[1]
      if (!params.success || !token) return c.body(null, 403)
      const { reportId, name } = params.output
      const file = await allowedUpload(
        c.env.REPORT_UPLOAD_SECRET,
        token,
        reportId,
        name,
        services.now()
      )
      if (!file) return c.body(null, 403)
      // The runtime holds a body to its declared length, so the declared size bounds the upload.
      if (Number(c.req.header('content-length')) !== file.size) return c.body(null, 400)
      const stream = c.req.raw.body
      if (!stream) return c.body(null, 400)
      await c.env.REPORTS.put(reportFileKey(reportId, name), stream, {
        httpMetadata: { contentType: 'application/octet-stream' }
      })
      return c.body(null, 204)
    })
}

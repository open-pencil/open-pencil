import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { validatedJSON } from '#feedback/http/request'
import { Hono } from 'hono'
import { timingSafeEqual } from 'hono/utils/buffer'
import * as v from 'valibot'

import { telegramChannel } from './telegram'

/** What Cloudflare's generic webhook sends; only these fields are read, the rest is ignored. */
const notificationSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.maxLength(200))),
  text: v.optional(v.pipe(v.string(), v.maxLength(4000))),
  alert_type: v.optional(v.pipe(v.string(), v.maxLength(100)))
})

/**
 * The monitor's routes. `/monitor/heartbeat` says when a check last ran, for the watchdog outside
 * Cloudflare (`tools/ci/cloud-deploy/src/watchdog.ts`); it names no check and no result.
 * `/monitor/cloudflare` forwards Cloudflare's notifications, such as its incident alerts, to the
 * channel; Cloudflare signs each with the webhook's secret in `cf-webhook-auth`, and anything else
 * gets a 401.
 */
export function monitorRoutes(services: FeedbackServices) {
  return new Hono<FeedbackEnv>()
    .get('/monitor/heartbeat', async (c) => {
      const latest = await createFeedbackDatabase(c.env.DB)
        .selectFrom('monitorState')
        .select((select) => select.fn.max('checkedAt').as('lastRun'))
        .executeTakeFirst()
      c.header('Cache-Control', 'no-store')
      return c.json({ lastRun: latest?.lastRun ?? null })
    })
    .post(
      '/monitor/cloudflare',
      async (c, next) => {
        const expected = c.env.CLOUDFLARE_WEBHOOK_SECRET
        const given = c.req.header('cf-webhook-auth')
        if (!expected || !given || !(await timingSafeEqual(given, expected)))
          return c.body(null, 401)
        return next()
      },
      validatedJSON(notificationSchema),
      async (c) => {
        const notification = c.req.valid('json')
        await telegramChannel(services.fetch, c.env.TELEGRAM_BOT_TOKEN, c.env.MONITOR_CHAT_ID).post(
          {
            tone: 'info',
            title: notification.name ?? 'Cloudflare notification',
            context: 'Cloudflare',
            body: notification.text,
            rows: notification.alert_type ? [['Type', notification.alert_type]] : [],
            link: {
              label: 'Open Cloudflare status',
              url: 'https://www.cloudflarestatus.com'
            }
          }
        )
        return c.body(null, 204)
      }
    )
}

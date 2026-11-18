import { createFeedbackApp, defaultServices } from './app'
import type { FeedbackBindings } from './env'
import { runMonitor } from './monitor'
import { runRetention } from './retention'
import { runSnapshot } from './snapshot'

const app = createFeedbackApp()
/** The triggers in `wrangler.jsonc`. */
const SNAPSHOT_CRON = '5 0 * * *'
const RETENTION_CRON = '17 3 * * *'
const MONITOR_CRON = '* * * * *'

export default {
  // `satisfies` keeps the declared bindings in step with `wrangler types`' generated `Env`.
  fetch: (request, env, ctx) => app.fetch(request, env satisfies FeedbackBindings, ctx),
  scheduled(controller, env, ctx) {
    const jobs = new Map<string, () => Promise<unknown>>([
      [SNAPSHOT_CRON, () => runSnapshot(env, defaultServices)],
      [RETENTION_CRON, () => runRetention(env, new Date())],
      [MONITOR_CRON, () => runMonitor(env, defaultServices, new Date(controller.scheduledTime))]
    ])
    const job = jobs.get(controller.cron)
    if (!job) throw new Error(`No job runs on the trigger ${controller.cron}`)
    ctx.waitUntil(job())
  }
} satisfies ExportedHandler<Env>

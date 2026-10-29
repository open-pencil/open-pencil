import { createFeedbackApp, defaultServices } from './app'
import type { FeedbackBindings } from './env'
import { runRetention } from './retention'
import { runSnapshot } from './snapshot'

const app = createFeedbackApp()
/** The metrics snapshot's trigger in `wrangler.jsonc`; the other one runs retention. */
const SNAPSHOT_CRON = '5 0 * * *'

export default {
  // `satisfies` keeps the declared bindings in step with `wrangler types`' generated `Env`.
  fetch: (request, env, ctx) => app.fetch(request, env satisfies FeedbackBindings, ctx),
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      controller.cron === SNAPSHOT_CRON
        ? runSnapshot(env, defaultServices)
        : runRetention(env, new Date())
    )
  }
} satisfies ExportedHandler<Env>

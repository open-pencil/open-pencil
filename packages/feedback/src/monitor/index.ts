import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackBindings, FeedbackServices } from '#feedback/env'
import { compact } from 'es-toolkit'

import type { CheckStatus, Observation } from './check'
import { checkBalance, checkKeyAllowance, type FundsThresholds } from './openrouter'
import { telegramChannel, type TelegramChannel } from './telegram'
import { checkUptime } from './uptime'
import { checkWorkerFailures } from './workers'

/** A check still failing is posted again this often, so a forgotten outage is not silent. */
const REMIND_AFTER_MS = 24 * 60 * 60_000
/** How often each kind of check runs, in minutes of the every-minute trigger. */
const WORKERS_EVERY_MINUTES = 5
const OPENROUTER_EVERY_MINUTES = 15

const list = (value: string) => compact(value.split(',').map((item) => item.trim()))

function duration(fromISO: string, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - Date.parse(fromISO)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
}

/**
 * Records what a check saw and tells the channel when it changed: once a new status has held for
 * the check's confirmation count, again a day later while it is still not `ok`, and once it
 * recovers. The first run of a check that is `ok` records it without a message.
 */
async function settle(
  env: FeedbackBindings,
  channel: TelegramChannel,
  observation: Observation,
  now: Date
): Promise<void> {
  const db = createFeedbackDatabase(env.DB)
  const previous = await db
    .selectFrom('monitorState')
    .selectAll()
    .where('checkName', '=', observation.name)
    .executeTakeFirst()
  const at = now.toISOString()
  const same = previous?.status === observation.status
  const runs = same ? previous.runs + 1 : 1
  const since = same ? previous.since : at
  let notifiedStatus: CheckStatus = previous?.notifiedStatus ?? 'ok'
  let notifiedAt = previous?.notifiedAt ?? at
  let problemSince = previous?.problemSince ?? null

  if (runs >= observation.confirmRuns) {
    if (observation.status === 'ok') {
      if (notifiedStatus !== 'ok') {
        await channel.post({
          tone: 'recovered',
          ...observation.recovered,
          rows: [
            ...(observation.recovered.rows ?? []),
            ['Lasted', duration(problemSince ?? since, new Date(since))]
          ]
        })
        notifiedStatus = 'ok'
        notifiedAt = at
        problemSince = null
      }
    } else if (
      notifiedStatus !== observation.status ||
      now.getTime() - Date.parse(notifiedAt) >= REMIND_AFTER_MS
    ) {
      await channel.post({
        tone: observation.status,
        ...observation.problem,
        rows: [...(observation.problem.rows ?? []), ['For', duration(problemSince ?? since, now)]]
      })
      problemSince ??= since
      notifiedStatus = observation.status
      notifiedAt = at
    }
  }

  await db
    .insertInto('monitorState')
    .values({
      checkName: observation.name,
      status: observation.status,
      runs,
      since,
      notifiedStatus,
      notifiedAt,
      problemSince,
      checkedAt: at
    })
    .onConflict((conflict) =>
      conflict.column('checkName').doUpdateSet({
        status: observation.status,
        runs,
        since,
        notifiedStatus,
        notifiedAt,
        problemSince,
        checkedAt: at
      })
    )
    .execute()
}

/**
 * The every-minute monitor: uptime each run, Worker failures every five minutes, and OpenRouter's
 * spending cap and balance every fifteen. Each check runs on its own; one that cannot be read is
 * logged and leaves its state as it was, and the first failure is thrown once all have run.
 */
export async function runMonitor(
  env: FeedbackBindings,
  services: FeedbackServices,
  scheduled: Date
): Promise<void> {
  const channel = telegramChannel(services.fetch, env.TELEGRAM_BOT_TOKEN, env.MONITOR_CHAT_ID)
  const minute = Math.round(scheduled.getTime() / 60_000)
  const funds: FundsThresholds = {
    warning: Number(env.OPENROUTER_WARNING_USD),
    critical: Number(env.OPENROUTER_CRITICAL_USD)
  }

  const checks: Promise<Observation | Observation[]>[] = list(env.MONITOR_URLS).map((url) =>
    checkUptime(services.fetch, url)
  )
  if (minute % WORKERS_EVERY_MINUTES === 0)
    checks.push(
      checkWorkerFailures(services.fetch, {
        account: env.CLOUDFLARE_ACCOUNT_ID,
        token: env.CLOUDFLARE_ANALYTICS_TOKEN,
        scripts: list(env.MONITOR_WORKERS),
        now: scheduled
      })
    )
  if (minute % OPENROUTER_EVERY_MINUTES === 0) {
    checks.push(checkKeyAllowance(services.fetch, env.OPENROUTER_API_KEY, funds))
    if (env.OPENROUTER_MANAGEMENT_KEY)
      checks.push(checkBalance(services.fetch, env.OPENROUTER_MANAGEMENT_KEY, funds))
  }

  const results = await Promise.allSettled(
    checks.map(async (check) => {
      const observed = await check
      for (const observation of Array.isArray(observed) ? observed : [observed])
        await settle(env, channel, observation, services.now())
    })
  )
  const failures = results.filter((result) => result.status === 'rejected')
  for (const failure of failures) console.error('A monitor check failed', failure.reason)
  if (failures[0]) throw failures[0].reason
}

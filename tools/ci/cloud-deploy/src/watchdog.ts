import * as v from 'valibot'

/**
 * The watchdog outside Cloudflare: the feedback Worker's monitor (`packages/feedback/src/monitor`)
 * watches the official deployments every minute, and this checks, from GitHub's runners, that the
 * monitor itself still runs. It catches what the monitor cannot report about itself: Cloudflare
 * down as a whole, the feedback Worker down, or its cron failing.
 */

export const HEARTBEAT_URL = 'https://feedback.openpencil.dev/monitor/heartbeat'
/** The monitor runs every minute; this long without a run means it stopped. */
export const STALE_AFTER_MS = 10 * 60_000
const TELEGRAM_CHAT_ID = '-1003998830069'
const WORKFLOW = 'monitor-watchdog.yml'
const REQUEST_TIMEOUT_MS = 15_000

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const heartbeatSchema = v.object({ lastRun: v.nullable(v.string()) })
const runsSchema = v.object({
  workflow_runs: v.array(v.object({ id: v.number(), conclusion: v.nullable(v.string()) }))
})

/** Why the monitor looks stopped, or `undefined` when it ran recently. */
export async function monitorProblem(fetch: Fetch, now: Date): Promise<string | undefined> {
  let response: Response
  try {
    response = await fetch(HEARTBEAT_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    return `The feedback Worker did not answer: ${error instanceof Error ? error.message : String(error)}`
  }
  if (response.status !== 200) return `The feedback Worker answered HTTP ${response.status}`
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), heartbeatSchema),
    await response.text()
  )
  if (!parsed.success) return 'The feedback Worker sent an unexpected heartbeat'
  const { lastRun } = parsed.output
  if (!lastRun) return 'The monitor has never run'
  const minutes = Math.round((now.getTime() - Date.parse(lastRun)) / 60_000)
  return now.getTime() - Date.parse(lastRun) > STALE_AFTER_MS
    ? `The monitor last ran ${minutes} minutes ago`
    : undefined
}

/** Whether this workflow's previous completed run passed, failed, or there was none. */
export async function previousConclusion(
  fetch: Fetch,
  options: { repository: string; token: string; runId: string }
): Promise<string | undefined> {
  const response = await fetch(
    `https://api.github.com/repos/${options.repository}/actions/workflows/${WORKFLOW}/runs?status=completed&per_page=5`,
    {
      headers: { Authorization: `Bearer ${options.token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
  )
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for the watchdog's runs`)
  const runs = v.parse(v.pipe(v.string(), v.parseJson(), runsSchema), await response.text())
  return runs.workflow_runs.find((run) => String(run.id) !== options.runId)?.conclusion ?? undefined
}

/**
 * What to tell the channel: only a change from the previous run, so a long outage posts once
 * when it starts and once when it ends. A run that finds a problem fails, which is how the next
 * run knows.
 */
export function messageFor(problem: string | undefined, previous: string | undefined) {
  if (problem && previous !== 'failure') return `🔴 The monitor has stopped · watchdog\n${problem}`
  if (!problem && previous === 'failure') return '🟢 The monitor is running again · watchdog'
  return undefined
}

async function postToTelegram(fetch: Fetch, token: string, text: string, runURL: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: `${text}\n${runURL}`,
      link_preview_options: { is_disabled: true }
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`Telegram refused the watchdog's message (${response.status})`)
}

if (import.meta.main) {
  const env = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
  }
  const repository = env('GITHUB_REPOSITORY')
  const runId = env('GITHUB_RUN_ID')
  const problem = await monitorProblem(fetch, new Date())
  const previous = await previousConclusion(fetch, {
    repository,
    token: env('GITHUB_TOKEN'),
    runId
  })
  const message = messageFor(problem, previous)
  if (message)
    await postToTelegram(
      fetch,
      env('TELEGRAM_BOT_TOKEN'),
      message,
      `${env('GITHUB_SERVER_URL')}/${repository}/actions/runs/${runId}`
    )
  if (problem) {
    console.log(`::error::${problem}`)
    process.exit(1)
  }
  console.log('The monitor ran recently')
}

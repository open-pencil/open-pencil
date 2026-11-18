import type { FeedbackServices } from '#feedback/env'
import * as v from 'valibot'

import type { CheckStatus, Observation } from './check'

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'
const REQUEST_TIMEOUT_MS = 15_000
const BUCKET_MS = 5 * 60_000
/** The five minutes just past may still be counting, so the newest bucket judged ends before them. */
const SETTLING_BUCKETS = 1
/** The hour before the bucket judged is what counts as usual. */
const BASELINE_BUCKETS = 12
/** Below this many failures in five minutes, nothing is a spike, however quiet it was before. */
const MIN_FAILURES = 10
/** A spike is this many times the usual failures per five minutes. */
const SPIKE_FACTOR = 5

// A failure is an invocation the runtime counts as an error, such as an uncaught exception or a
// limit, or an answer of 500 or more: neither reaches PostHog when the code never got to report it.
const QUERY = `query ($account: String!, $start: Time!, $end: Time!, $scripts: [String!]) {
  viewer { accounts(filter: { accountTag: $account }) {
    invocations: workersInvocationsAdaptive(
      limit: 1000
      filter: { datetime_geq: $start, datetime_lt: $end, scriptName_in: $scripts }
    ) { sum { requests errors } dimensions { scriptName datetimeFiveMinutes } }
    failed: workersInvocationsAdaptive(
      limit: 1000
      filter: { datetime_geq: $start, datetime_lt: $end, scriptName_in: $scripts, httpResponseStatus_geq: 500 }
    ) { sum { requests } dimensions { scriptName datetimeFiveMinutes } }
  } }
}`

const dimensionsSchema = v.object({
  scriptName: v.string(),
  datetimeFiveMinutes: v.string()
})
const answerSchema = v.object({
  data: v.nullable(
    v.object({
      viewer: v.object({
        accounts: v.array(
          v.object({
            invocations: v.array(
              v.object({
                sum: v.object({ requests: v.number(), errors: v.number() }),
                dimensions: dimensionsSchema
              })
            ),
            failed: v.array(
              v.object({ sum: v.object({ requests: v.number() }), dimensions: dimensionsSchema })
            )
          })
        )
      })
    })
  ),
  errors: v.nullish(v.array(v.object({ message: v.string() })))
})

interface Bucket {
  requests: number
  failures: number
}

function judge(latest: Bucket, usual: number): CheckStatus {
  if (latest.failures < MIN_FAILURES || latest.failures < usual * SPIKE_FACTOR) return 'ok'
  return latest.failures * 2 > latest.requests ? 'critical' : 'warning'
}

/**
 * For each Worker, whether its failures in the latest settled five minutes spiked against the hour
 * before, from Cloudflare's Workers analytics; a failed or unexpected answer throws.
 */
export async function checkWorkerFailures(
  fetcher: FeedbackServices['fetch'],
  options: {
    account: string
    token: string
    scripts: readonly string[]
    now: Date
  }
): Promise<Observation[]> {
  const end = Math.floor(options.now.getTime() / BUCKET_MS - SETTLING_BUCKETS) * BUCKET_MS
  const latestStart = end - BUCKET_MS
  const start = latestStart - BASELINE_BUCKETS * BUCKET_MS
  const response = await fetcher(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        account: options.account,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        scripts: options.scripts
      }
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`Cloudflare analytics answered ${response.status}`)
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), answerSchema), await response.text())
  if (!result.success) throw new Error('Cloudflare analytics sent an unexpected answer')
  const refused = result.output.errors?.at(0)
  if (refused) throw new Error(`Cloudflare analytics refused the query: ${refused.message}`)
  const account = result.output.data?.viewer.accounts.at(0)
  if (!account) throw new Error('Cloudflare analytics returned no data for the account')

  const latestKey = new Date(latestStart).toISOString().replace('.000Z', 'Z')
  return options.scripts.map((script) => {
    const latest: Bucket = { requests: 0, failures: 0 }
    let baseline = 0
    const add = (at: string, requests: number, failures: number) => {
      if (at === latestKey) {
        latest.requests += requests
        latest.failures += failures
      } else baseline += failures
    }
    for (const row of account.invocations)
      if (row.dimensions.scriptName === script)
        add(row.dimensions.datetimeFiveMinutes, row.sum.requests, row.sum.errors)
    for (const row of account.failed)
      if (row.dimensions.scriptName === script)
        add(row.dimensions.datetimeFiveMinutes, 0, row.sum.requests)
    const usual = baseline / BASELINE_BUCKETS
    const rows: [string, string][] = [
      ['Failed in 5 min', String(latest.failures)],
      ['Requests in 5 min', String(latest.requests)],
      ['Usual per 5 min', usual.toFixed(1)]
    ]
    const link = {
      label: 'Open Workers logs',
      url: `https://dash.cloudflare.com/${options.account}/workers/services/view/${script}/production/observability/logs`
    }
    return {
      name: `worker failures ${script}`,
      status: judge(latest, usual),
      confirmRuns: 1,
      problem: {
        title: `${script} is failing more than usual`,
        context: 'Workers',
        body: 'Uncaught exceptions, exceeded limits, and answers of 500 or more, which PostHog misses when the code never reports them.',
        rows,
        link
      },
      recovered: {
        title: `${script} failures are back to usual`,
        context: 'Workers',
        rows
      }
    }
  })
}

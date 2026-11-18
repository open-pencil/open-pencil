import type { FeedbackServices } from '#feedback/env'
import * as v from 'valibot'

import type { CheckStatus, Observation } from './check'

const OPENROUTER_API = 'https://openrouter.ai/api/v1'
const REQUEST_TIMEOUT_MS = 15_000
const DASHBOARD = 'https://openrouter.ai/settings/credits'

/** Below these many US dollars left, the channel hears a warning, then an urgent alert. */
export interface FundsThresholds {
  warning: number
  critical: number
}

const keySchema = v.object({
  data: v.object({
    label: v.nullish(v.string()),
    limit: v.nullish(v.number()),
    limit_remaining: v.nullish(v.number()),
    limit_reset: v.nullish(v.string()),
    usage_daily: v.nullish(v.number()),
    usage_monthly: v.nullish(v.number())
  })
})

const creditsSchema = v.object({
  data: v.object({ total_credits: v.number(), total_usage: v.number() })
})

async function read<T extends v.GenericSchema>(
  fetcher: FeedbackServices['fetch'],
  path: string,
  key: string,
  schema: T
): Promise<v.InferOutput<T>> {
  const response = await fetcher(`${OPENROUTER_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`OpenRouter answered ${path} with ${response.status}`)
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
  if (!result.success) throw new Error(`OpenRouter sent an unexpected answer to ${path}`)
  return result.output
}

function statusOf(left: number, thresholds: FundsThresholds): CheckStatus {
  if (left < thresholds.critical) return 'critical'
  return left < thresholds.warning ? 'warning' : 'ok'
}

const dollars = (amount: number) => `$${amount.toFixed(2)}`

/**
 * How much of the key's own spending cap is left. A key at its cap refuses every model request
 * even while the account has credits, and a top-up does not lift it; a key without a cap passes.
 */
export async function checkKeyAllowance(
  fetcher: FeedbackServices['fetch'],
  key: string,
  thresholds: FundsThresholds
): Promise<Observation> {
  const { data } = await read(fetcher, '/key', key, keySchema)
  const left = data.limit_remaining
  const rows: [string, string][] = []
  if (data.limit != null) rows.push(['Cap', dollars(data.limit)])
  if (left != null) rows.push(['Left', dollars(left)])
  if (data.limit_reset) rows.push(['Resets', data.limit_reset])
  if (data.usage_daily != null) rows.push(['Spent today', dollars(data.usage_daily)])
  if (data.usage_monthly != null) rows.push(['Spent this month', dollars(data.usage_monthly)])
  const name = data.label ? `OpenRouter key ${data.label}` : 'OpenRouter key'
  return {
    name: 'openrouter key',
    status: left == null ? 'ok' : statusOf(left, thresholds),
    confirmRuns: 1,
    problem: {
      title: `${name} is near its spending cap`,
      context: 'Cloud AI',
      body: 'Once it reaches the cap, every Cloud AI request fails, whatever the account balance. Raise the cap or wait for it to reset.',
      rows,
      link: {
        label: 'Open OpenRouter keys',
        url: 'https://openrouter.ai/settings/keys'
      }
    },
    recovered: { title: `${name} has room again`, context: 'Cloud AI', rows }
  }
}

/** The account's credit balance, which every key spends from; it needs a management key. */
export async function checkBalance(
  fetcher: FeedbackServices['fetch'],
  managementKey: string,
  thresholds: FundsThresholds
): Promise<Observation> {
  const { data } = await read(fetcher, '/credits', managementKey, creditsSchema)
  const left = data.total_credits - data.total_usage
  const rows: [string, string][] = [
    ['Balance', dollars(left)],
    ['Bought', dollars(data.total_credits)],
    ['Used', dollars(data.total_usage)]
  ]
  return {
    name: 'openrouter balance',
    status: statusOf(left, thresholds),
    confirmRuns: 1,
    problem: {
      title: 'OpenRouter credits are running out',
      context: 'Cloud AI',
      body: 'Once they run out, every Cloud AI request fails. Buy more credits.',
      rows,
      link: { label: 'Buy credits', url: DASHBOARD }
    },
    recovered: {
      title: 'OpenRouter credits topped up',
      context: 'Cloud AI',
      rows
    }
  }
}

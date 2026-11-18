import type { FeedbackServices } from '#feedback/env'

import type { Observation } from './check'

const REQUEST_TIMEOUT_MS = 10_000
/** A single slow or failed answer is often the network; three minutes of them is an outage. */
const CONFIRM_RUNS = 3

/** Whether `url` answers 200 within the timeout, as a service's health route does when it is up. */
export async function checkUptime(
  fetcher: FeedbackServices['fetch'],
  url: string
): Promise<Observation> {
  const { host } = new URL(url)
  let failure: string | undefined
  try {
    const response = await fetcher(url, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    await response.body?.cancel()
    if (response.status !== 200) failure = `HTTP ${response.status}`
  } catch (error) {
    failure =
      error instanceof Error && error.name === 'TimeoutError'
        ? `No answer within ${REQUEST_TIMEOUT_MS / 1000} s`
        : `Request failed: ${error instanceof Error ? error.message : String(error)}`
  }
  return {
    name: `uptime ${url}`,
    status: failure ? 'critical' : 'ok',
    confirmRuns: CONFIRM_RUNS,
    problem: {
      title: `${host} is down`,
      context: 'uptime',
      body: failure,
      rows: [['URL', url]]
    },
    recovered: {
      title: `${host} is back up`,
      context: 'uptime',
      rows: [['URL', url]]
    }
  }
}

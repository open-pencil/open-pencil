import type { FeedbackServices } from '#feedback/env'
import * as v from 'valibot'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SITEVERIFY_TIMEOUT_MS = 10_000

const siteverifySchema = v.object({
  success: v.boolean(),
  hostname: v.optional(v.string()),
  action: v.optional(v.string())
})

/**
 * Whether Turnstile accepts the token as one issued on one of our `hostnames` for `action`. Anything else,
 * including an unreachable or slow Turnstile, refuses. The client address is optional to
 * Turnstile and is not sent. Turnstile itself rejects a token used twice.
 */
export async function verifyTurnstile(
  fetcher: FeedbackServices['fetch'],
  {
    secret,
    token,
    hostnames,
    action
  }: { secret: string; token: string; hostnames: readonly string[]; action: string }
): Promise<boolean> {
  const response = await fetcher(SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
    signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS)
  }).catch(() => null)
  if (!response?.ok) return false
  const result = v.safeParse(
    v.pipe(v.string(), v.parseJson(), siteverifySchema),
    await response.text()
  )
  return (
    result.success &&
    result.output.success &&
    hostnames.some((hostname) => hostname === result.output.hostname) &&
    result.output.action === action
  )
}

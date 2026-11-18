import { CLOUD_BILLING_API_PATHS } from '#cloud/contract'
import { userIdText, type CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'
import { joinURL } from 'ufo'

import type { BillingTokenService } from './tokens'

export type SeatNotifierOptions = {
  database: Kysely<CloudDatabase>
  /** The billing service's discovered endpoint. */
  endpoint: string
  tokens: BillingTokenService
  /** Sends a notice; the global `fetch` by default. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
}

/**
 * Tells the billing service when the people who can edit in an account's workspaces change, so it
 * can charge for the seats. Each notice carries a billing token for that account and nothing
 * else: the service reads the count from Cloud's internal API, so a notice that never arrives only
 * leaves the change to the service's own reconciliation.
 */
export function createSeatNotifier(options: SeatNotifierOptions) {
  const send = options.fetch ?? ((url: string, init: RequestInit) => fetch(url, init))
  return {
    async notify(accountIds: readonly string[]): Promise<void> {
      if (accountIds.length === 0) return
      const accounts = await options.database
        .selectFrom('user')
        .select((eb) => [userIdText(eb).as('userId'), 'email'])
        .where((eb) => eb(userIdText(eb), 'in', accountIds))
        .execute()
      // Every notice is sent before any failure is reported, so one refusal never leaves
      // another account's notice cut off.
      const sent = await Promise.allSettled(
        accounts.map(async (account) => {
          const { token } = await options.tokens.issue(account)
          const response = await send(joinURL(options.endpoint, CLOUD_BILLING_API_PATHS.seats), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (!response.ok) {
            throw new Error(`Billing refused a seat notice with status ${response.status}`)
          }
        })
      )
      const failed: unknown[] = sent.flatMap((result): unknown[] =>
        result.status === 'rejected' ? [result.reason] : []
      )
      if (failed.length > 0) throw new AggregateError(failed, 'Billing missed seat notices')
    }
  }
}

export type SeatNotifier = ReturnType<typeof createSeatNotifier>

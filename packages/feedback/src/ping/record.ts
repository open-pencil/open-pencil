import type { Ping } from '#feedback/contract'
import { utcDayOf } from '#feedback/days'
import { createFeedbackDatabase, runBatch } from '#feedback/db'
import type { D1Database } from '@cloudflare/workers-types/index'
import * as v from 'valibot'

/** The network a request came from, as Cloudflare reports it: the autonomous system, never the address. */
export interface PingNetwork {
  asn: number
  name: string
}

const UNKNOWN_NETWORK: PingNetwork = { asn: 0, name: '' }

// Cloudflare attaches `cf` to every request it forwards to a Worker; requests from elsewhere,
// such as tests, may carry none.
const requestNetworkSchema = v.object({
  cf: v.object({
    asn: v.pipe(v.number(), v.integer(), v.minValue(0)),
    asOrganization: v.optional(v.string(), '')
  })
})

/** The network Cloudflare reports for `request`, or AS 0 with no name when it reports none. */
export function requestNetwork(request: Request): PingNetwork {
  const parsed = v.safeParse(requestNetworkSchema, request)
  return parsed.success
    ? { asn: parsed.output.cf.asn, name: parsed.output.cf.asOrganization }
    : UNKNOWN_NETWORK
}

/**
 * Adds one to today's count for the ping's build and answer, and to today's count for its
 * network, in one batch; no row ever describes a single install.
 */
export async function recordPing(
  d1: D1Database,
  ping: Ping,
  network: PingNetwork,
  now: Date
): Promise<void> {
  const db = createFeedbackDatabase(d1)
  const day = utcDayOf(now).toString()
  await runBatch(d1, [
    db
      .insertInto('usagePings')
      .values({ ...ping, day, count: 1 })
      .onConflict((conflict) =>
        conflict
          .columns(['day', 'version', 'platform', 'arch', 'app', 'browser', 'usageStats'])
          .doUpdateSet((eb) => ({ count: eb('usagePings.count', '+', 1) }))
      )
      .compile(),
    db
      .insertInto('pingNetworks')
      .values({ day, ...network, app: ping.app, platform: ping.platform, count: 1 })
      .onConflict((conflict) =>
        conflict
          .columns(['day', 'asn', 'app', 'platform', 'name'])
          .doUpdateSet((eb) => ({ count: eb('pingNetworks.count', '+', 1) }))
      )
      .compile()
  ])
}

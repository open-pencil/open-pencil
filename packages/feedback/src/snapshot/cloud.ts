import type { Fetcher } from '@cloudflare/workers-types/index'
import type { CalendarDate } from '@internationalized/date'
import * as v from 'valibot'

import { DEADLINE_MS } from '@open-pencil/std/timing'

/** The longest range Cloud's internal API answers for in one request. */
export const CLOUD_USAGE_MAX_DAYS = 400

const countSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))

const cloudUsageSchema = v.object({
  days: v.array(
    v.object({
      day: v.pipe(v.string(), v.isoDate()),
      signUps: countSchema,
      activeAccounts: countSchema,
      documentsCreated: countSchema,
      revisions: countSchema
    })
  ),
  totals: v.object({
    accounts: countSchema,
    documents: countSchema,
    workspaces: countSchema,
    storageBytes: countSchema
  })
})
export type CloudUsage = v.InferOutput<typeof cloudUsageSchema>

/**
 * Reads Cloud's daily counts over the service binding, with the internal API's bearer token.
 * Cloud answers with counts only; a failed or unexpected answer throws.
 */
export async function fetchCloudUsage(
  cloud: Pick<Fetcher, 'fetch'>,
  token: string,
  start: CalendarDate,
  end: CalendarDate
): Promise<CloudUsage> {
  const query = new URLSearchParams({ start: start.toString(), end: end.toString() })
  // The binding reaches the Worker directly; the host only has to be one Cloud serves.
  const response = await cloud.fetch(
    `https://cloud.openpencil.dev/api/internal/usage/daily?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DEADLINE_MS.slowRequest)
    }
  )
  if (!response.ok) throw new Error(`Cloud usage answered ${response.status}`)
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), cloudUsageSchema),
    await response.text()
  )
  if (!parsed.success) throw new Error('Cloud usage sent an unexpected answer')
  return parsed.output
}

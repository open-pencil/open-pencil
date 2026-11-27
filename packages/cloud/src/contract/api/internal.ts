import { parseDate } from '@internationalized/date'
import { oc, type ErrorMap } from '@orpc/contract'
import * as v from 'valibot'

import { staticEntitlementsSchema } from '../entitlements'
import { at } from './route'

/** An account the internal API acts on, named by its UUID. */
const accountParamsSchema = v.object({ userId: v.pipe(v.string(), v.uuid(), v.toLowerCase()) })

/** A plan a service that decides entitlements, such as billing, sets for an account. */
export const setAccountEntitlementsSchema = v.object({
  values: staticEntitlementsSchema,
  /** Who decided these values, such as `billing`; stored as the row's source. */
  source: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)),
  /** Increases with every decision the writer makes, such as a billing event's timestamp. */
  externalVersion: v.pipe(v.number(), v.safeInteger(), v.minValue(0))
})

/** The most days one usage request spans. */
export const MAX_USAGE_RANGE_DAYS = 400

/** `day` as a calendar day, or `undefined` for a date that does not exist, such as February 30. */
function calendarDay(day: string) {
  try {
    const date = parseDate(day)
    return date.toString() === day ? date : undefined
  } catch {
    return undefined
  }
}

const isoDaySchema = v.pipe(
  v.string(),
  v.isoDate(),
  v.check((day) => calendarDay(day) !== undefined, 'Expected a calendar day')
)

/** The calendar's last day, whose end has no next midnight to bound a query with. */
const LAST_DAY = '9999-12-31'

/** A span of whole UTC days, both ends included, ending before the calendar's last day. */
export const usageRangeSchema = v.pipe(
  v.object({
    start: isoDaySchema,
    end: v.pipe(
      isoDaySchema,
      v.check((day) => day < LAST_DAY, 'Expected a day before the calendar’s last')
    )
  }),
  v.check(({ start, end }) => {
    const [from, to] = [calendarDay(start), calendarDay(end)]
    if (!from || !to) return false
    const days = to.compare(from)
    return days >= 0 && days < MAX_USAGE_RANGE_DAYS
  }, `Expected a start on or before the end, at most ${MAX_USAGE_RANGE_DAYS} days apart`)
)

const countSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))

/** One UTC day of the deployment's use, in counts only. */
export const usageDaySchema = v.object({
  day: isoDaySchema,
  /** Accounts created that day. */
  signUps: countSchema,
  /** Accounts that signed in or saved a document revision that day, each once. */
  activeAccounts: countSchema,
  /** Documents created that day and still kept, in Trash or not; those deleted forever drop out. */
  documentsCreated: countSchema,
  /** Document revisions saved that day. */
  revisions: countSchema
})

export const dailyUsageSchema = v.object({
  days: v.array(usageDaySchema),
  /** The deployment as it stands now. */
  totals: v.object({
    accounts: countSchema,
    /** Documents not in Trash or deleted. */
    documents: countSchema,
    workspaces: countSchema,
    /** Bytes the workspaces' stored files take. */
    storageBytes: countSchema
  })
})

const route = oc.errors({
  not_found: {},
  invalid_request: {},
  unauthorized: {}
} satisfies ErrorMap)

/**
 * What the deployment's own services, such as billing, ask of Cloud under `/api/internal`, with the
 * internal API's bearer token: setting an account's plan, counting the seats it pays for, and
 * counting the deployment's use per day for its operator's dashboard. The usage report's own
 * token reaches only `dailyUsage`; any other route answers it `unauthorized`.
 */
export const internalContract = {
  setAccountEntitlements: route
    .meta(at('PUT', '/accounts/{userId}/entitlements'))
    .input(v.object({ params: accountParamsSchema, body: setAccountEntitlementsSchema }))
    .output(v.object({ applied: v.boolean() })),
  accountSeats: route
    .meta(at('GET', '/accounts/{userId}/seats'))
    .input(v.object({ params: accountParamsSchema }))
    .output(v.object({ seats: v.pipe(v.number(), v.integer(), v.minValue(0)) })),
  dailyUsage: route
    .meta(at('GET', '/usage/daily'))
    .input(v.object({ query: usageRangeSchema }))
    .output(dailyUsageSchema)
}

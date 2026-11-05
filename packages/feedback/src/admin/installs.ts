import { PING_STEP_STARTS, PING_STEPS } from '#feedback/contract'
import { eachDay } from '#feedback/days'
import type { FeedbackDatabase } from '#feedback/db'
import { type CalendarDate, parseDate } from '@internationalized/date'
import { groupBy, sumBy } from 'es-toolkit'
import type { Kysely } from 'kysely'

/** A day's pings for one app and step, with those that entered the step counted apart. */
export interface StepCount {
  day: string
  app: string
  step: string
  entered: number
  count: number
}

/** A day's pings from versions that send a step, by what the counting laws allow them to be. */
export interface InstallDay {
  day: string
  /** Pings from an install's first day with a ping. */
  new: number
  /** Pings from an install's later days that the steps before can account for. */
  returning: number
  /** Pings the steps before cannot account for: more than ever reached the step, or ever could. */
  replayed: number
}

/** How many days with a ping an install spends in each step, in `PING_STEPS` order. */
const WIDTHS = PING_STEP_STARTS.map(
  (start, index) => (PING_STEP_STARTS[index + 1] ?? Number.POSITIVE_INFINITY) - start
)
const STEP_INDEX = new Map<string, number>(PING_STEPS.map((step, index) => [step, index]))

/**
 * One app's days, oldest first, without identifying a single install. Every install passes
 * through the steps in order, one day with a ping at a time, so three laws bound what the pings
 * of a step can be:
 *
 * - Installs entering a step by day `t` are at most those that entered the step before by day
 *   `t − w`, where `w` is that step's width: an install spends `w` days with a ping there first.
 *   Applied step by step, the bound only ever counts installs the first step saw arrive.
 * - On any day, a step's pings are at most the installs that ever entered it: one ping a day each.
 * - Over all days, a step's pings are at most its width times the installs that entered it.
 *
 * A copy of a saved state replays the same step on every launch, so it soon exceeds what the step
 * before supplied; what exceeds a bound is `replayed`. Every bound holds for real installs, so the
 * returning count never drops below theirs. New installs have nothing before them to check.
 */
function countApp(rows: StepCount[], days: string[]): InstallDay[] {
  const steps = PING_STEPS.length
  const byDay = groupBy(rows, (row) => row.day)
  const arrived = PING_STEPS.map(() => 0)
  const allowed: number[][] = []
  const used = PING_STEPS.map(() => 0)
  return days.map((day, index) => {
    const pings = PING_STEPS.map(() => 0)
    for (const row of byDay[day] ?? []) {
      const step = STEP_INDEX.get(row.step)
      if (step === undefined) continue
      pings[step] += row.count
      if (row.entered) arrived[step] += row.count
    }
    const bound = arrived.map((count, step) => {
      if (step === 0) return count
      const before = allowed[index - WIDTHS[step - 1]]?.[step - 1] ?? 0
      return Math.min(count, before)
    })
    allowed.push(bound)
    let returning = 0
    let replayed = 0
    for (let step = 1; step < steps; step++) {
      // The last step never ends, so only the daily bound applies to it.
      const budget = Number.isFinite(WIDTHS[step])
        ? WIDTHS[step] * bound[step] - used[step]
        : Number.POSITIVE_INFINITY
      const counted = Math.max(0, Math.min(pings[step], bound[step], budget))
      used[step] += counted
      returning += counted
      replayed += pings[step] - counted
    }
    return { day, new: pings[0], returning, replayed }
  })
}

/** Every day from the first step count through `end`, for desktop and web together. */
export function countInstalls(rows: StepCount[], end: CalendarDate): InstallDay[] {
  const first = rows.map((row) => row.day).toSorted()[0]
  if (!first) return []
  const days = eachDay(parseDate(first), end).map(String)
  const perApp = Object.values(groupBy(rows, (row) => row.app)).map((appRows) =>
    countApp(appRows, days)
  )
  return days.map((day, index) => {
    const onDay = perApp.map((app) => app[index])
    return {
      day,
      new: sumBy(onDay, (app) => app.new),
      returning: sumBy(onDay, (app) => app.returning),
      replayed: sumBy(onDay, (app) => app.replayed)
    }
  })
}

/** The range's days as the counting laws allow them, from every step count up to its end. */
export async function installs(
  db: Kysely<FeedbackDatabase>,
  end: CalendarDate,
  days: string[]
): Promise<InstallDay[]> {
  // The bounds build up from the first day with steps, so the whole history up to the end counts.
  const rows = await db
    .selectFrom('pingSteps')
    .selectAll()
    .where('day', '<=', end.toString())
    .execute()
  const counted = new Map(countInstalls(rows, end).map((day) => [day.day, day]))
  return days.map((day) => counted.get(day) ?? { day, new: 0, returning: 0, replayed: 0 })
}

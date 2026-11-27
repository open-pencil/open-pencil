import type { dailyUsageSchema, usageRangeSchema } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { utcDayOf } from '#cloud/server/db/expressions'
import { parseDate, toZoned } from '@internationalized/date'
import type { Kysely } from 'kysely'
import type * as v from 'valibot'

export type UsageRange = v.InferOutput<typeof usageRangeSchema>
export type DailyUsage = v.InferOutput<typeof dailyUsageSchema>

type DayCount = { day: string; count: number | string | bigint }

const DAY_MS = 24 * 60 * 60 * 1000
const midnight = (day: string) => toZoned(parseDate(day), 'UTC').toDate()

/** Every day of the range, oldest first, as ISO dates; counted out, as adding a day saturates at year 9999. */
function eachDay({ start, end }: UsageRange): string[] {
  const first = parseDate(start)
  const span = parseDate(end).compare(first)
  return Array.from({ length: span + 1 }, (_, index) => first.add({ days: index }).toString())
}

const byDay = (rows: DayCount[]) => new Map(rows.map((row) => [row.day, Number(row.count)]))

/**
 * The deployment's use per UTC day of `range`, and its totals now, as counts alone: no account,
 * document, or workspace leaves in any other form.
 *
 * Saves and active accounts come from counters kept as they happen (`#cloud/server/usage`), since
 * cleanup deletes old revisions and sign-ins; sign-ups and documents count the rows still kept, so
 * deleted accounts and documents deleted forever drop out. An account is active on a day it signed
 * in or saved a revision. Edits in a collaboration room are logged as the room's own updates,
 * which name no account, so a day spent only editing in a room counts the account through its
 * sign-in alone.
 */
export async function dailyUsage(
  database: Kysely<CloudDatabase>,
  range: UsageRange
): Promise<DailyUsage> {
  const from = midnight(range.start)
  // The moment after the end day, without calendar addition, which saturates at year 9999.
  const until = new Date(midnight(range.end).getTime() + DAY_MS)

  const [signUps, documents, revisions, active, totals, storage] = await Promise.all([
    database
      .selectFrom('user')
      .select([utcDayOf('user.createdAt').as('day'), (eb) => eb.fn.countAll().as('count')])
      .where('user.createdAt', '>=', from)
      .where('user.createdAt', '<', until)
      .groupBy('day')
      .execute(),
    database
      .selectFrom('document')
      .select([utcDayOf('document.createdAt').as('day'), (eb) => eb.fn.countAll().as('count')])
      .where('document.createdAt', '>=', from)
      .where('document.createdAt', '<', until)
      // Kept through its cleanup grace, but deleted forever all the same.
      .where('document.purgedAt', 'is', null)
      .groupBy('day')
      .execute(),
    database
      .selectFrom('dailyRevisionCount')
      .select(['day', 'count'])
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .execute(),
    database
      .selectFrom('dailyActiveAccount')
      .select(['day', (eb) => eb.fn.countAll().as('count')])
      .where('day', '>=', range.start)
      .where('day', '<=', range.end)
      .groupBy('day')
      .execute(),
    database
      .selectNoFrom((eb) => [
        eb.selectFrom('user').select(eb.fn.countAll().as('count')).as('accounts'),
        eb
          .selectFrom('document')
          .select(eb.fn.countAll().as('count'))
          .where('document.deletedAt', 'is', null)
          .as('documents'),
        eb.selectFrom('workspace').select(eb.fn.countAll().as('count')).as('workspaces')
      ])
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('workspaceStorageUsage')
      .select((eb) => eb.fn.sum('workspaceStorageUsage.committedBytes').as('bytes'))
      .executeTakeFirst()
  ])

  const counts = {
    signUps: byDay(signUps),
    documentsCreated: byDay(documents),
    revisions: byDay(revisions),
    activeAccounts: byDay(active)
  }
  return {
    days: eachDay(range).map((day) => ({
      day,
      signUps: counts.signUps.get(day) ?? 0,
      activeAccounts: counts.activeAccounts.get(day) ?? 0,
      documentsCreated: counts.documentsCreated.get(day) ?? 0,
      revisions: counts.revisions.get(day) ?? 0
    })),
    totals: {
      accounts: Number(totals.accounts ?? 0),
      documents: Number(totals.documents ?? 0),
      workspaces: Number(totals.workspaces ?? 0),
      storageBytes: Number(storage?.bytes ?? 0)
    }
  }
}

import type { dailyUsageSchema, usageRangeSchema } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { utcDayOf } from '#cloud/server/db/expressions'
import { parseDate, toZoned } from '@internationalized/date'
import type { Kysely } from 'kysely'
import type * as v from 'valibot'

export type UsageRange = v.InferOutput<typeof usageRangeSchema>
export type DailyUsage = v.InferOutput<typeof dailyUsageSchema>

type DayCount = { day: string; count: number | string | bigint }

const midnight = (day: string) => toZoned(parseDate(day), 'UTC').toDate()

/** Every day of the range, oldest first, as ISO dates. */
function eachDay({ start, end }: UsageRange): string[] {
  const days: string[] = []
  for (let day = parseDate(start); day.compare(parseDate(end)) <= 0; day = day.add({ days: 1 }))
    days.push(day.toString())
  return days
}

const byDay = (rows: DayCount[]) => new Map(rows.map((row) => [row.day, Number(row.count)]))

/**
 * The deployment's use per UTC day of `range`, and its totals now, as counts alone: no account,
 * document, or workspace leaves in any other form.
 *
 * An account is active on a day it signed in or saved a revision of a document. Edits in a
 * collaboration room are logged as the room's own updates, which name no account, and reach a
 * revision only when someone saves one, so a day spent only editing in a room counts the
 * account through its sign-in alone.
 */
export async function dailyUsage(
  database: Kysely<CloudDatabase>,
  range: UsageRange
): Promise<DailyUsage> {
  const from = midnight(range.start)
  const until = midnight(parseDate(range.end).add({ days: 1 }).toString())

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
      .groupBy('day')
      .execute(),
    database
      .selectFrom('documentRevision')
      .select([
        utcDayOf('documentRevision.createdAt').as('day'),
        (eb) => eb.fn.countAll().as('count')
      ])
      .where('documentRevision.createdAt', '>=', from)
      .where('documentRevision.createdAt', '<', until)
      .groupBy('day')
      .execute(),
    database
      .selectFrom(
        database
          .selectFrom('signIn')
          .select((eb) => [
            utcDayOf('signIn.createdAt').as('day'),
            eb.cast<string>('signIn.userId', 'text').as('account')
          ])
          .where('signIn.createdAt', '>=', from)
          .where('signIn.createdAt', '<', until)
          .union(
            database
              .selectFrom('documentRevision')
              .select([
                utcDayOf('documentRevision.createdAt').as('day'),
                'documentRevision.createdBy as account'
              ])
              .where('documentRevision.createdAt', '>=', from)
              .where('documentRevision.createdAt', '<', until)
          )
          .as('activity')
      )
      .select(['activity.day', (eb) => eb.fn.count('activity.account').distinct().as('count')])
      .groupBy('activity.day')
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

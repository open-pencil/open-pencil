import type { FeedbackDatabase } from '#feedback/db'
import type { D1Database } from '@cloudflare/workers-types/index'
import type { CalendarDate } from '@internationalized/date'
import { chunk } from 'es-toolkit'
import type { CompiledQuery, Insertable, Kysely } from 'kysely'

/** Kysely builds the statements; D1 runs a day's replacement as one batch, which is atomic. */
export interface SnapshotStore {
  db: Kysely<FeedbackDatabase>
  d1: D1Database
}

type SnapshotTable =
  | 'githubStars'
  | 'releaseDownloads'
  | 'repoTraffic'
  | 'repoReferrers'
  | 'siteVisits'
  | 'sitePages'
  | 'siteCountries'

// D1 binds at most 100 values per statement, so long lists go in several statements.
const MAX_BOUND_VALUES = 100

type ClearDays = (db: Kysely<FeedbackDatabase>, days: string[]) => CompiledQuery

// One query per table: Kysely cannot type a delete over a union of tables.
const CLEAR_DAYS: Record<SnapshotTable, ClearDays> = {
  githubStars: (db, days) => db.deleteFrom('githubStars').where('day', 'in', days).compile(),
  releaseDownloads: (db, days) =>
    db.deleteFrom('releaseDownloads').where('day', 'in', days).compile(),
  repoTraffic: (db, days) => db.deleteFrom('repoTraffic').where('day', 'in', days).compile(),
  repoReferrers: (db, days) => db.deleteFrom('repoReferrers').where('day', 'in', days).compile(),
  siteVisits: (db, days) => db.deleteFrom('siteVisits').where('day', 'in', days).compile(),
  sitePages: (db, days) => db.deleteFrom('sitePages').where('day', 'in', days).compile(),
  siteCountries: (db, days) => db.deleteFrom('siteCountries').where('day', 'in', days).compile()
}

/**
 * Makes `days` hold exactly `rows`: whatever was recorded for those days goes first, so an
 * entry the latest answer no longer has (a host without visits, a page out of the ranking, a
 * removed release file) does not linger, and a rerun corrects a day instead of adding to it.
 * The deletes and inserts run as one D1 batch, so a failure leaves the old rows in place.
 */
export async function replaceDays<T extends SnapshotTable>(
  { db, d1 }: SnapshotStore,
  table: T,
  days: CalendarDate[],
  rows: Insertable<FeedbackDatabase[T]>[]
): Promise<void> {
  const statements = chunk(
    days.map((day) => day.toString()),
    MAX_BOUND_VALUES
  ).map((batch) => CLEAR_DAYS[table](db, batch))
  const [first] = rows
  if (first) {
    const perStatement = Math.max(1, Math.floor(MAX_BOUND_VALUES / Object.keys(first).length))
    for (const batch of chunk(rows, perStatement))
      statements.push(db.insertInto(table).values(batch).compile())
  }
  await runBatch(d1, statements)
}

async function runBatch(d1: D1Database, statements: CompiledQuery[]): Promise<void> {
  if (!statements.length) return
  await d1.batch(statements.map((query) => d1.prepare(query.sql).bind(...query.parameters)))
}

/** Adds issues and pull requests, or updates the ones already mirrored, in one batch. */
export async function saveRepoItems(
  { db, d1 }: SnapshotStore,
  items: Insertable<FeedbackDatabase['repoItems']>[]
): Promise<void> {
  if (!items.length) return
  const perStatement = Math.floor(MAX_BOUND_VALUES / Object.keys(items[0]).length)
  await runBatch(
    d1,
    chunk(items, perStatement).map((batch) =>
      db
        .insertInto('repoItems')
        .values(batch)
        .onConflict((conflict) =>
          conflict.column('number').doUpdateSet((eb) => ({
            kind: eb.ref('excluded.kind'),
            authorAssociation: eb.ref('excluded.authorAssociation'),
            createdAt: eb.ref('excluded.createdAt'),
            closedAt: eb.ref('excluded.closedAt'),
            mergedAt: eb.ref('excluded.mergedAt'),
            updatedAt: eb.ref('excluded.updatedAt')
          }))
        )
        .compile()
    )
  )
}

/** GitHub's newest update among the mirrored issues and pull requests, if any are. */
export async function lastItemUpdate(db: Kysely<FeedbackDatabase>): Promise<string | undefined> {
  const row = await db
    .selectFrom('repoItems')
    .select((eb) => eb.fn.max('updatedAt').as('updatedAt'))
    .executeTakeFirst()
  return row?.updatedAt ?? undefined
}

/** The newest day recorded in a table, if any. */
export async function lastDay(
  db: Kysely<FeedbackDatabase>,
  table: 'siteVisits'
): Promise<string | undefined> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.max('day').as('day'))
    .executeTakeFirst()
  return row?.day ?? undefined
}

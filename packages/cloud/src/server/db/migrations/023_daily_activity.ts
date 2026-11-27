import { sql, type Kysely } from 'kysely'

import { dropTables, required } from './schema'

const TABLES = ['daily_revision_count', 'daily_active_account'] as const

/**
 * Saves per UTC day and the accounts active on each day, kept apart from the revisions and
 * sign-ins they count: compaction deletes saves once they are a day old, so the usage report
 * could not count them there. Both start from what is still recorded.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('daily_revision_count')
    .addColumn('day', 'text', (column) => column.primaryKey())
    .addColumn('count', 'integer', (column) => column.notNull().defaultTo(0))
    .execute()
  await database.schema
    .createTable('daily_active_account')
    .addColumn('day', 'text', required)
    // Better Auth builds `user` after Cloud's migrations, so account deletion removes these rows.
    .addColumn('user_id', 'text', required)
    .addPrimaryKeyConstraint('daily_active_account_pkey', ['day', 'user_id'])
    .execute()
  await sql`
    insert into daily_revision_count (day, count)
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD'), count(*)
    from document_revision
    group by 1
  `.execute(database)
  // Better Auth builds `user` after Cloud's migrations, so a new database has no accounts, and no
  // activity, to fill in. An existing one marks only accounts that still exist: a deleted one's
  // revisions can stay in a shared workspace.
  const { rows } = await sql<{ accounts: string | null }>`
    select to_regclass('"user"')::text as accounts
  `.execute(database)
  if (!rows[0]?.accounts) return
  await sql`
    insert into daily_active_account (day, user_id)
    select activity.day, activity.user_id
    from (
      select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, user_id::text as user_id
      from sign_in
      union
      select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD'), created_by from document_revision
    ) as activity
    where exists (select 1 from "user" where "user".id::text = activity.user_id)
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}

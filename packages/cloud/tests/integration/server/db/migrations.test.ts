import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { followsConvention, ownedNames } from '#cloud-tests/helpers/schema'
import { CloudMigrationProvider } from '#cloud/server/db/migrate'
import { sql } from 'kysely'
import { Migrator, NO_MIGRATIONS } from 'kysely/migration'

describe('Cloud migrations', () => {
  test('name every key, check, and index the same way', async () => {
    const context = await createCloudTestDatabase()
    try {
      const entries = await ownedNames(context.database)
      expect(entries.filter((entry) => !followsConvention(entry))).toEqual([])
      // The keys and checks the application relies on are all there.
      const names = new Set(entries.map((entry) => entry.name))
      for (const name of [
        'document_current_revision_id_fkey',
        'revision_image_workspace_id_checksum_fkey',
        'document_grant_document_id_user_id_key',
        'workspace_member_pkey',
        'document_room_update_pkey',
        'transactional_email_kind_check',
        'document_report_reason_check',
        'upload_status_check'
      ]) {
        expect(names.has(name)).toBe(true)
      }
    } finally {
      await context.close()
    }
  })

  test('roll back to Better Auth’s tables alone', async () => {
    const context = await createCloudTestDatabase()
    try {
      const migrator = new Migrator({
        db: context.database,
        provider: new CloudMigrationProvider()
      })
      expect((await migrator.migrateTo(NO_MIGRATIONS)).error).toBeUndefined()
      const tables = await sql<{ name: string }>`
        select tablename as name from pg_tables where schemaname = 'public'`.execute(
        context.database
      )
      expect(tables.rows.map((table) => table.name).toSorted()).toEqual([
        'account',
        'device_code',
        'kysely_migration',
        'kysely_migration_lock',
        'passkey',
        'rate_limit',
        'session',
        'two_factor',
        'user',
        'verification'
      ])
    } finally {
      await context.close()
    }
  })
  test('give accounts a language on a database whose Better Auth schema was built before', async () => {
    const context = await createCloudTestDatabase()
    try {
      // A database from before: Better Auth's `user` table without the field, which its own
      // migration never adds again.
      const migrator = new Migrator({
        db: context.database,
        provider: new CloudMigrationProvider()
      })
      expect((await migrator.migrateTo('011_account_ids')).error).toBeUndefined()
      await context.database.schema.alterTable('user').dropColumn('locale').execute()
      expect((await migrator.migrateToLatest()).error).toBeUndefined()
      const columns = await sql<{ name: string }>`
        select column_name as name from information_schema.columns
        where table_name = 'user' and column_name = 'locale'`.execute(context.database)
      expect(columns.rows).toHaveLength(1)
    } finally {
      await context.close()
    }
  })

  test('keep a document as a deck, and a rollback keeps it as a design', async () => {
    const context = await createCloudTestDatabase()
    try {
      const { database } = context
      const migrator = new Migrator({ db: database, provider: new CloudMigrationProvider() })
      const kinds = async () =>
        (await sql<{ kind: string }>`select kind from document`.execute(database)).rows
      await sql`set session_replication_role = replica`.execute(database)
      await sql`
        insert into document (id, workspace_id, name, kind, created_by)
        values (gen_random_uuid(), gen_random_uuid(), 'Pitch', 'slides', 'someone')`.execute(
        database
      )
      expect(await kinds()).toEqual([{ kind: 'slides' }])
      expect((await migrator.migrateTo('020_document_description')).error).toBeUndefined()
      expect(await kinds()).toEqual([{ kind: 'design' }])
      expect((await migrator.migrateToLatest()).error).toBeUndefined()
    } finally {
      await context.close()
    }
  })

  test('start the usage counters from what is recorded, for accounts that still exist', async () => {
    const context = await createCloudTestDatabase()
    try {
      const { database } = context
      const migrator = new Migrator({ db: database, provider: new CloudMigrationProvider() })
      expect((await migrator.migrateTo('022_revision_cover')).error).toBeUndefined()
      await sql`set session_replication_role = replica`.execute(database)
      const kept = crypto.randomUUID()
      const deleted = crypto.randomUUID()
      await sql`
        insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values (${kept}, 'Kept', 'kept@example.com', true, now(), now())`.execute(database)
      await sql`
        insert into sign_in (id, user_id, method, created_at) values
          (gen_random_uuid(), ${kept}, 'password', '2026-11-01T09:00:00Z'),
          (gen_random_uuid(), ${deleted}, 'password', '2026-11-01T09:00:00Z')`.execute(database)
      // A deleted account's save stays in the workspace it shared.
      await sql`
        insert into document_revision (id, document_id, storage_object_id, created_by, created_at)
        values
          (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ${kept}, '2026-11-02T09:00:00Z'),
          (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ${deleted}, '2026-11-02T10:00:00Z')`.execute(
        database
      )
      expect((await migrator.migrateToLatest()).error).toBeUndefined()
      const marks = await sql<{ day: string; userId: string }>`
        select day, user_id from daily_active_account order by day`.execute(database)
      expect(marks.rows).toEqual([
        { day: '2026-11-01', userId: kept },
        { day: '2026-11-02', userId: kept }
      ])
      const saves = await sql<{ day: string; count: number }>`
        select day, count from daily_revision_count`.execute(database)
      expect(saves.rows).toEqual([{ day: '2026-11-02', count: 2 }])
    } finally {
      await context.close()
    }
  })
})

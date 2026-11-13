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
})

import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as accounts from './migrations/001_accounts'
import * as workspaces from './migrations/002_workspaces'
import * as storage from './migrations/003_storage'
import * as documents from './migrations/004_documents'
import * as sharing from './migrations/005_sharing'
import * as operations from './migrations/006_operations'
import * as trash from './migrations/007_trash'
import * as terms from './migrations/008_terms'
import * as accessTokens from './migrations/009_access_tokens'
import * as storageLimitNotices from './migrations/010_storage_limit_notices'
import * as accountIds from './migrations/011_account_ids'
import * as emailLocales from './migrations/012_email_locales'
import * as documentBlockEmails from './migrations/013_document_block_emails'
import * as reportReplies from './migrations/014_report_replies'
import type { CloudDatabase } from './tables'

/**
 * A migration runs before the code it ships with, while the previous release still serves, so it
 * only adds (expand): no table or column dropped, renamed, retyped, or newly required. One that
 * must (contract) names each table or `table.column` it changes in `contracts`, and ships a
 * release after the last code that used them (`tests/integration/server/db/expand.test.ts`).
 */
export type CloudMigration = Migration & { contracts?: readonly string[] }

const migrations: Record<string, CloudMigration> = {
  '001_accounts': accounts,
  '002_workspaces': workspaces,
  '003_storage': storage,
  '004_documents': documents,
  '005_sharing': sharing,
  '006_operations': operations,
  '007_trash': trash,
  '008_terms': terms,
  '009_access_tokens': accessTokens,
  '010_storage_limit_notices': storageLimitNotices,
  '011_account_ids': accountIds,
  '012_email_locales': emailLocales,
  '013_document_block_emails': documentBlockEmails,
  '014_report_replies': reportReplies
}

/** Cloud's migrations, in order. */
export class CloudMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, CloudMigration>> {
    return migrations
  }
}

export type CloudAuthMigration = {
  run(): Promise<void>
  schemaVersion: string
}

/**
 * Better Auth's tables come from its own migration API, once, after Cloud's: the version they
 * were built for is recorded, and a different one stops startup until someone migrates it
 * deliberately, since Better Auth cannot say what an upgrade between its versions changes.
 */
async function migrateAuthSchema(
  database: Kysely<CloudDatabase>,
  migration: CloudAuthMigration
): Promise<void> {
  const recorded = await database
    .selectFrom('authSchemaVersion')
    .select('version')
    .where('id', '=', 'better-auth')
    .executeTakeFirst()
  if (recorded) {
    if (recorded.version !== migration.schemaVersion) {
      throw new Error(
        `Better Auth schema ${recorded.version} requires an explicit migration to ${migration.schemaVersion}`
      )
    }
    return
  }
  await migration.run()
  await database
    .insertInto('authSchemaVersion')
    .values({ id: 'better-auth', version: migration.schemaVersion, updatedAt: new Date() })
    .execute()
}

/** Runs a migrator to its latest migration, failing with every error it reports. */
export async function migrateToLatest(migrator: Migrator, failure: string): Promise<void> {
  const result = await migrator.migrateToLatest()
  const failed = result.results?.find((migration) => migration.status === 'Error')
  if (result.error || failed) {
    throw new AggregateError(
      [result.error, failed ? new Error(`Migration failed: ${failed.migrationName}`) : null].filter(
        (error): error is Error => error instanceof Error
      ),
      failure
    )
  }
}

export async function migrateCloudDatabase(
  database: Kysely<CloudDatabase>,
  authMigration?: CloudAuthMigration
): Promise<void> {
  await migrateToLatest(
    new Migrator({ db: database, provider: new CloudMigrationProvider() }),
    'OpenPencil Cloud database migration failed'
  )
  if (authMigration) await migrateAuthSchema(database, authMigration)
}

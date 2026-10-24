import { migrateToLatest } from '#cloud/server/db/migrate'
import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as usage from './migrations/001_usage'
import type { AIRelayDatabase } from './schema'

const migrations: Record<string, Migration> = {
  '001_usage': usage
}

class AIRelayMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

/**
 * The relay keeps its own migration history, so it can share a PostgreSQL database with Cloud
 * without either one seeing the other's migrations as unknown.
 */
export async function migrateAIRelayDatabase(database: Kysely<AIRelayDatabase>): Promise<void> {
  await migrateToLatest(
    new Migrator({
      db: database,
      provider: new AIRelayMigrationProvider(),
      migrationTableName: 'ai_relay_migration',
      migrationLockTableName: 'ai_relay_migration_lock'
    }),
    'OpenPencil AI relay database migration failed'
  )
}

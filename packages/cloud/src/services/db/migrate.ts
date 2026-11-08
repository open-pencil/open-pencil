import { migrateToLatest } from '#cloud/server/db/migrate'
import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as baseline from './migrations/001_baseline'
import type { ServicesDatabase } from './schema'

const migrations: Record<string, Migration> = {
  '001_baseline': baseline
}

class ServicesMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

/**
 * The services server keeps its own migration history, so it can share a PostgreSQL database
 * with Cloud without either one seeing the other's migrations as unknown.
 */
export async function migrateServicesDatabase(database: Kysely<ServicesDatabase>): Promise<void> {
  await migrateToLatest(
    new Migrator({
      db: database,
      provider: new ServicesMigrationProvider(),
      migrationTableName: 'services_migration',
      migrationLockTableName: 'services_migration_lock'
    }),
    'OpenPencil services database migration failed'
  )
}

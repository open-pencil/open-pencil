import { migrateToLatest, type CloudMigration } from '#cloud/server/db/migrate'
import type { Kysely } from 'kysely'
import { Migrator, type MigrationProvider } from 'kysely/migration'

import * as baseline from './migrations/001_baseline'
import type { ServicesDatabase } from './schema'

/** Expand-only, as Cloud's are (see `CloudMigration`). */
const migrations: Record<string, CloudMigration> = {
  '001_baseline': baseline
}

export const SERVICES_MIGRATION_TABLES = {
  migrationTableName: 'services_migration',
  migrationLockTableName: 'services_migration_lock'
} as const

export class ServicesMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, CloudMigration>> {
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
      ...SERVICES_MIGRATION_TABLES
    }),
    'OpenPencil services database migration failed'
  )
}

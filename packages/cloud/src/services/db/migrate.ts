import { renameTableOnce } from '#cloud/server/db/expressions'
import { migrateToLatest } from '#cloud/server/db/migrate'
import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as usage from './migrations/001_usage'
import * as servicesUsage from './migrations/002_services_usage'
import type { ServicesDatabase } from './schema'

const migrations: Record<string, Migration> = {
  '001_usage': usage,
  '002_services_usage': servicesUsage
}

class ServicesMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

/** Where the services server keeps its migration history, and what it was called before. */
const HISTORY = [
  ['ai_relay_migration', 'services_migration'],
  ['ai_relay_migration_lock', 'services_migration_lock']
] as const

/**
 * The services server keeps its own migration history, so it can share a PostgreSQL database
 * with Cloud without either one seeing the other's migrations as unknown. A database it migrated
 * as the AI relay has that history under the old names, which take the new ones first.
 */
export async function migrateServicesDatabase(database: Kysely<ServicesDatabase>): Promise<void> {
  for (const [from, to] of HISTORY) await renameTableOnce(database, from, to)
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

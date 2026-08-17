import type { CloudAuth } from '#cloud/server/auth'
import { getMigrations } from 'better-auth/db/migration'
import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as foundation from './migrations/001_foundation'
import * as cleanupClaims from './migrations/002_upload_cleanup_claims'
import * as documentCleanupClaims from './migrations/003_document_cleanup_claims'
import * as documentSharing from './migrations/004_document_sharing'
import * as documentCollaborationEpoch from './migrations/005_document_collaboration_epoch'
import * as invitationContinuation from './migrations/006_invitation_continuation'
import * as collaborationState from './migrations/007_collaboration_state'
import type { CloudDatabase } from './schema'

const migrations: Record<string, Migration> = {
  '001_foundation': foundation,
  '002_upload_cleanup_claims': cleanupClaims,
  '003_document_cleanup_claims': documentCleanupClaims,
  '004_document_sharing': documentSharing,
  '005_document_collaboration_epoch': documentCollaborationEpoch,
  '006_invitation_continuation': invitationContinuation,
  '007_collaboration_state': collaborationState
}

class CloudMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

export async function migrateCloudDatabase(
  database: Kysely<CloudDatabase>,
  auth?: CloudAuth
): Promise<void> {
  const migrator = new Migrator({
    db: database,
    provider: new CloudMigrationProvider()
  })
  const result = await migrator.migrateToLatest()
  const failed = result.results?.find((migration) => migration.status === 'Error')
  if (result.error || failed) {
    throw new AggregateError(
      [result.error, failed ? new Error(`Migration failed: ${failed.migrationName}`) : null].filter(
        (error): error is Error => error instanceof Error
      ),
      'OpenPencil Cloud database migration failed'
    )
  }
  if (auth) {
    const authMigrations = await getMigrations(auth.options)
    await authMigrations.runMigrations()
  }
}

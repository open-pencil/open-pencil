import type { Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'

import * as foundation from './migrations/001_foundation'
import * as cleanupClaims from './migrations/002_upload_cleanup_claims'
import * as documentCleanupClaims from './migrations/003_document_cleanup_claims'
import * as documentSharing from './migrations/004_document_sharing'
import * as documentCollaborationEpoch from './migrations/005_document_collaboration_epoch'
import * as invitationContinuation from './migrations/006_invitation_continuation'
import * as collaborationState from './migrations/007_collaboration_state'
import * as storageReservations from './migrations/008_storage_reservations'
import * as workspaceEntitlements from './migrations/009_workspace_entitlements'
import * as uploadFinalization from './migrations/010_upload_finalization'
import * as uploadFinalizationLease from './migrations/011_upload_finalization_lease'
import * as transactionalEmail from './migrations/012_transactional_email'
import * as adminEnrollment from './migrations/013_admin_enrollment'
import * as enrollmentEmailKinds from './migrations/014_enrollment_email_kinds'
import * as cloudRateLimit from './migrations/015_cloud_rate_limit'
import * as authSchema from './migrations/016_auth_schema'
import * as authenticationEmailKinds from './migrations/017_authentication_email_kinds'
import * as authenticationMFA from './migrations/018_authentication_mfa'
import type { CloudDatabase } from './schema'

const migrations: Record<string, Migration> = {
  '001_foundation': foundation,
  '002_upload_cleanup_claims': cleanupClaims,
  '003_document_cleanup_claims': documentCleanupClaims,
  '004_document_sharing': documentSharing,
  '005_document_collaboration_epoch': documentCollaborationEpoch,
  '006_invitation_continuation': invitationContinuation,
  '007_collaboration_state': collaborationState,
  '008_storage_reservations': storageReservations,
  '009_workspace_entitlements': workspaceEntitlements,
  '010_upload_finalization': uploadFinalization,
  '011_upload_finalization_lease': uploadFinalizationLease,
  '012_transactional_email': transactionalEmail,
  '013_admin_enrollment': adminEnrollment,
  '014_enrollment_email_kinds': enrollmentEmailKinds,
  '015_cloud_rate_limit': cloudRateLimit,
  '016_auth_schema': authSchema,
  '017_authentication_email_kinds': authenticationEmailKinds,
  '018_authentication_mfa': authenticationMFA
}

class CloudMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

export type CloudAuthMigration = {
  run(): Promise<void>
  schemaVersion: string
}

const REQUIRED_AUTH_SCHEMA: Record<string, string[]> = {
  user: [
    'id',
    'name',
    'email',
    'email_verified',
    'created_at',
    'updated_at',
    'role',
    'banned',
    'two_factor_enabled'
  ],
  session: ['id', 'expires_at', 'token', 'user_id', 'impersonated_by'],
  account: ['id', 'issuer', 'account_id', 'provider_id', 'user_id'],
  verification: ['id', 'identifier', 'value', 'expires_at'],
  device_code: ['id', 'device_code', 'user_code', 'status', 'client_id'],
  rate_limit: ['id', 'key', 'count', 'last_request'],
  two_factor: [
    'id',
    'secret',
    'backup_codes',
    'user_id',
    'verified',
    'failed_verification_count',
    'locked_until'
  ],
  passkey: ['id', 'public_key', 'user_id', 'credential_id', 'counter', 'device_type', 'backed_up']
}

async function existingAuthSchema(
  database: Kysely<CloudDatabase>
): Promise<Map<string, Set<string>>> {
  const tables = await database.introspection.getTables()
  return new Map(
    tables
      .filter((table) => Object.hasOwn(REQUIRED_AUTH_SCHEMA, table.name))
      .map((table) => [table.name, new Set(table.columns.map((column) => column.name))])
  )
}

async function migrateAuthSchema(
  database: Kysely<CloudDatabase>,
  migration: CloudAuthMigration
): Promise<void> {
  const recorded = await database
    .selectFrom('cloudAuthSchema')
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

  const existing = await existingAuthSchema(database)
  if (existing.size === 0) {
    await migration.run()
  } else {
    const missing = Object.entries(REQUIRED_AUTH_SCHEMA).flatMap(([table, requiredColumns]) => {
      const columns = existing.get(table)
      if (!columns) return [table]
      return requiredColumns
        .filter((column) => !columns.has(column))
        .map((column) => `${table}.${column}`)
    })
    if (missing.length > 0) {
      throw new Error(`Existing Better Auth schema is incomplete: ${missing.join(', ')}`)
    }
  }

  await database
    .insertInto('cloudAuthSchema')
    .values({ id: 'better-auth', version: migration.schemaVersion, updatedAt: new Date() })
    .execute()
}

export async function migrateCloudDatabase(
  database: Kysely<CloudDatabase>,
  authMigration?: CloudAuthMigration
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
  if (authMigration) await migrateAuthSchema(database, authMigration)
}

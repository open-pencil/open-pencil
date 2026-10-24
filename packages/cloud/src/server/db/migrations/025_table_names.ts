import { sql, type Kysely } from 'kysely'

/**
 * OpenPencil's tables beside Better Auth's lose the `cloud_` prefix the rest never had; only the
 * rate limit keeps a qualifier, since Better Auth has a `rate_limit` of its own. Their keys,
 * checks, and indexes follow, so no name keeps the old prefix.
 */
const TABLES = [
  ['cloud_enrollment', 'enrollment'],
  ['cloud_mfa_assurance', 'mfa_assurance'],
  ['cloud_admin_audit_event', 'admin_audit_event'],
  ['cloud_auth_schema', 'auth_schema_version'],
  ['cloud_rate_limit', 'api_rate_limit']
] as const

const CONSTRAINTS = [
  ['enrollment', 'cloud_enrollment_pkey', 'enrollment_pkey'],
  ['enrollment', 'cloud_enrollment_email_normalized_key', 'enrollment_email_normalized_key'],
  ['enrollment', 'cloud_enrollment_status_check', 'enrollment_status_check'],
  ['mfa_assurance', 'cloud_mfa_assurance_pkey', 'mfa_assurance_pkey'],
  ['admin_audit_event', 'cloud_admin_audit_event_pkey', 'admin_audit_event_pkey'],
  ['auth_schema_version', 'cloud_auth_schema_pkey', 'auth_schema_version_pkey'],
  ['api_rate_limit', 'cloud_rate_limit_pkey', 'api_rate_limit_pkey']
] as const

const INDEXES = [
  ['cloud_enrollment_status_index', 'enrollment_status_index'],
  ['cloud_admin_audit_created_index', 'admin_audit_event_created_index']
] as const

async function rename(database: Kysely<unknown>, direction: 'up' | 'down'): Promise<void> {
  const forward = direction === 'up'
  if (forward) {
    for (const [from, to] of TABLES) await database.schema.alterTable(from).renameTo(to).execute()
  }
  // Tables carry their new names while their constraints and indexes are renamed either way.
  for (const [table, from, to] of CONSTRAINTS) {
    await database.schema
      .alterTable(table)
      .renameConstraint(forward ? from : to, forward ? to : from)
      .execute()
  }
  for (const [from, to] of INDEXES) {
    const [source, target] = forward ? [from, to] : [to, from]
    await sql`alter index ${sql.id(source)} rename to ${sql.id(target)}`.execute(database)
  }
  if (!forward) {
    for (const [from, to] of TABLES) await database.schema.alterTable(to).renameTo(from).execute()
  }
}

export async function up(database: Kysely<unknown>): Promise<void> {
  await rename(database, 'up')
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await rename(database, 'down')
}

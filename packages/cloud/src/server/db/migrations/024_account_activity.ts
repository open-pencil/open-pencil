import { CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

import { replaceCheckConstraint } from './helpers'

const emailKinds = [
  'document-invitation',
  'workspace-invitation',
  'enrollment-requested',
  'admin-enrollment-notification',
  'enrollment-approved',
  'enrollment-rejected',
  'enrollment-revoked',
  'email-verification',
  'password-reset',
  'password-changed'
]

/**
 * Every sign-in an account makes, so its owner can read where it was used and hear about one from
 * an address it never signed in from; a session keeps the row of the sign-in that made it, which
 * names how it was made. The security notices that follow get their own email kinds.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('sign_in')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    // Better Auth's tables may come after this migration, so the account is not a foreign key.
    .addColumn('user_id', 'uuid', (column) => column.notNull())
    .addColumn('session_id', 'uuid')
    .addColumn('method', 'text', (column) => column.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .execute()
  await database.schema
    .createIndex('sign_in_user_index')
    .on('sign_in')
    .columns(['user_id', 'created_at'])
    .execute()
  await database.schema
    .createIndex('sign_in_session_index')
    .on('sign_in')
    .column('session_id')
    .execute()
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    [...emailKinds, 'email-change-requested', 'new-sign-in', 'two-step-changed']
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    emailKinds
  )
  await database.schema.dropTable('sign_in').execute()
}

import type { Kysely } from 'kysely'

import {
  addChecks,
  addIndexes,
  dropTables,
  now,
  PERMISSIONS,
  required,
  withInvitation
} from './schema'

/** Who a document is shared with: people, invitations, links, and the invitations budget. */
const TABLES = [
  'document_grant',
  'document_invitation',
  'invitation_continuation',
  'document_share',
  'invitation_send'
]

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('document_grant')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('user_id', 'text', required)
    .addColumn('permission', 'text', required)
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('revoked_at', 'timestamptz')
    .addUniqueConstraint('document_grant_document_id_user_id_key', ['document_id', 'user_id'])
    .execute()
  await withInvitation(database.schema.createTable('document_invitation'), 'permission')
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .execute()
  // An invitation's token carried through a sign-in that leaves the editor, encrypted.
  await database.schema
    .createTable('invitation_continuation')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('invitation_id', 'uuid', (column) =>
      column.notNull().references('document_invitation.id').onDelete('cascade')
    )
    .addColumn('token_encrypted', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('consumed_at', 'timestamptz')
    .execute()
  await database.schema
    .createTable('document_share')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('permission', 'text', required)
    .addColumn('secret_hash', 'text', required)
    .addColumn('room_epoch', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('last_used_at', 'timestamptz')
    .execute()
  // Each invitation sent, for the daily invitation budget; kept apart from the invitations.
  await database.schema
    .createTable('invitation_send')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('sender_id', 'text', required)
    .addColumn('email_normalized', 'text', required)
    .addColumn('sent_at', 'timestamptz', now)
    .execute()
  await addChecks(database, [
    ['document_grant', 'permission', PERMISSIONS],
    ['document_invitation', 'permission', PERMISSIONS],
    ['document_share', 'permission', PERMISSIONS]
  ])
  await addIndexes(database, [
    ['document_grant', ['user_id', 'document_id']],
    ['document_invitation', ['document_id', 'revoked_at']],
    ['document_share', ['document_id', 'revoked_at']],
    ['invitation_continuation', ['expires_at']],
    ['invitation_send', ['sender_id', 'sent_at']],
    ['invitation_send', ['email_normalized', 'sent_at']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}

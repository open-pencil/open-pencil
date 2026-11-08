import { checkColumnIn, CURRENT_TIMESTAMP, EMPTY_JSON_OBJECT } from '#cloud/server/db/expressions'
import type { ColumnDefinitionBuilder, CreateTableBuilder, Kysely } from 'kysely'

/**
 * Cloud's schema as it stood when it first shipped: every table OpenPencil owns, beside the ones
 * Better Auth creates after it (see `migrateCloudDatabase`). Names follow PostgreSQL's own:
 * `<table>_pkey`, `<table>_<columns>_key` for unique, `<table>_<columns>_fkey`, and
 * `<table>_<column>_check`; indexes are `<table>_<columns>_idx`. Account IDs are text, since
 * Better Auth's tables may not exist yet, and never foreign keys.
 */

const now = (column: ColumnDefinitionBuilder) => column.notNull().defaultTo(CURRENT_TIMESTAMP)
const required = (column: ColumnDefinitionBuilder) => column.notNull()

/** What every emailed invitation keeps: whom it went to, its access, its secret, and its life. */
function withInvitation<Table extends string>(
  table: CreateTableBuilder<Table>,
  access: 'permission' | 'role'
) {
  return table
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email_normalized', 'text', required)
    .addColumn(access, 'text', required)
    .addColumn('token_hash', 'text', required)
    .addColumn('invited_by', 'text', required)
    .addColumn('invited_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
}

const PERMISSIONS = ['view', 'edit']
const ROLES = ['admin', 'editor', 'viewer']

/** Text columns that take one of a few values. */
const CHECKS: readonly (readonly [table: string, column: string, values: readonly string[]])[] = [
  ['document', 'kind', ['design', 'board']],
  ['document_grant', 'permission', PERMISSIONS],
  ['document_invitation', 'permission', PERMISSIONS],
  ['document_share', 'permission', PERMISSIONS],
  ['document_version', 'kind', ['checkpoint', 'named']],
  ['document_report', 'reason', ['spam-phishing', 'illegal', 'copyright', 'harassment', 'other']],
  ['document_report', 'status', ['open', 'dismissed', 'actioned']],
  ['upload', 'kind', ['revision', 'image']],
  ['upload', 'status', ['pending', 'finalizing', 'cleaning', 'committed', 'abandoned']],
  ['workspace_member', 'role', ROLES],
  ['workspace_invitation', 'role', ROLES],
  ['enrollment', 'status', ['pending', 'approved', 'rejected', 'revoked']],
  ['user_picture', 'format', ['png', 'jpeg']],
  ['user_picture', 'source', ['upload', 'provider']],
  [
    'transactional_email',
    'kind',
    [
      'document-invitation',
      'workspace-invitation',
      'enrollment-requested',
      'admin-enrollment-notification',
      'enrollment-approved',
      'enrollment-rejected',
      'enrollment-revoked',
      'email-verification',
      'password-reset',
      'password-changed',
      'email-change-requested',
      'new-sign-in',
      'two-step-changed',
      'document-report'
    ]
  ],
  ['transactional_email', 'status', ['pending', 'sending', 'accepted', 'failed', 'suppressed']]
]

/** Lookups beyond primary keys and unique columns; a `desc` column sorts newest first. */
const INDEXES: readonly (readonly [table: string, columns: readonly string[]])[] = [
  ['workspace', ['owner_id']],
  ['workspace_member', ['user_id']],
  ['workspace_invitation', ['workspace_id', 'revoked_at']],
  ['document', ['workspace_id', 'updated_at']],
  ['document', ['deleted_at', 'cleanup_claimed_at']],
  ['document_revision', ['document_id', 'created_at']],
  ['document_version', ['document_id', 'created_at desc', 'id desc']],
  ['document_grant', ['user_id', 'document_id']],
  ['document_invitation', ['document_id', 'revoked_at']],
  ['document_share', ['document_id', 'revoked_at']],
  ['document_report', ['document_id']],
  ['document_report', ['share_id', 'created_at']],
  ['document_report', ['status', 'created_at']],
  ['revision_image', ['workspace_id', 'checksum']],
  ['upload', ['status', 'expires_at']],
  ['invitation_continuation', ['expires_at']],
  ['invitation_send', ['sender_id', 'sent_at']],
  ['invitation_send', ['email_normalized', 'sent_at']],
  ['transactional_email', ['status', 'next_attempt_at']],
  ['enrollment', ['status', 'requested_at']],
  ['admin_audit_event', ['created_at']],
  ['sign_in', ['user_id', 'created_at']],
  ['sign_in', ['session_id']]
]

/** Every table the baseline creates, which `down` drops. */
const TABLES = [
  'storage_object',
  'workspace',
  'workspace_member',
  'workspace_invitation',
  'workspace_storage_usage',
  'account_entitlement',
  'document',
  'document_revision',
  'document_version',
  'document_grant',
  'document_invitation',
  'invitation_continuation',
  'document_share',
  'document_room_snapshot',
  'document_room_update',
  'document_report',
  'workspace_image',
  'revision_image',
  'upload',
  'upload_storage_reservation',
  'invitation_send',
  'transactional_email',
  'enrollment',
  'admin_audit_event',
  'api_rate_limit',
  'auth_schema_version',
  'mfa_assurance',
  'sign_in',
  'user_picture'
] as const

async function createWorkspaces(database: Kysely<unknown>): Promise<void> {
  // A stored file, by content; revisions, snapshots, and images refer to one.
  await database.schema
    .createTable('storage_object')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('object_key', 'text', (column) => column.notNull().unique())
    .addColumn('checksum', 'text', required)
    .addColumn('byte_size', 'bigint', required)
    .addColumn('content_type', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  // A workspace takes its limits from its owner's plan.
  await database.schema
    .createTable('workspace')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('name', 'text', required)
    .addColumn('slug', 'text', (column) => column.notNull().unique())
    .addColumn('created_by', 'text', required)
    .addColumn('owner_id', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('workspace_member')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('user_id', 'text', required)
    .addColumn('role', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('workspace_member_pkey', ['workspace_id', 'user_id'])
    .execute()
  await withInvitation(database.schema.createTable('workspace_invitation'), 'role')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .execute()
  await database.schema
    .createTable('workspace_storage_usage')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.primaryKey().references('workspace.id').onDelete('cascade')
    )
    .addColumn('committed_bytes', 'bigint', (column) => column.notNull().defaultTo(0))
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  // An account's plan, as billing or an operator set it.
  await database.schema
    .createTable('account_entitlement')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('values', 'jsonb', required)
    .addColumn('source', 'text', required)
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('external_version', 'bigint')
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
}

async function createDocuments(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('document')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('name', 'text', required)
    .addColumn('kind', 'text', (column) => column.notNull().defaultTo('design'))
    .addColumn('current_revision_id', 'uuid')
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('collaboration_epoch', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('cleanup_claim_id', 'uuid')
    .addColumn('cleanup_claimed_at', 'timestamptz')
    .addColumn('disabled_at', 'timestamptz')
    .addColumn('disabled_reason', 'text')
    .execute()
  await database.schema
    .createTable('document_revision')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('parent_revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('set null')
    )
    .addColumn('storage_object_id', 'uuid', (column) =>
      column.notNull().references('storage_object.id').onDelete('restrict')
    )
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  // A document and its revisions refer to each other, so this key comes once both exist.
  await database.schema
    .alterTable('document')
    .addForeignKeyConstraint(
      'document_current_revision_id_fkey',
      ['current_revision_id'],
      'document_revision',
      ['id'],
      (constraint) => constraint.onDelete('set null')
    )
    .execute()
  await database.schema
    .createTable('document_version')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('revision_id', 'uuid', (column) =>
      column.notNull().unique().references('document_revision.id').onDelete('cascade')
    )
    .addColumn('kind', 'text', required)
    .addColumn('name', 'text')
    .addColumn('description', 'text')
    .addColumn('restored_from_version_id', 'uuid', (column) =>
      column.references('document_version.id').onDelete('set null')
    )
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
}

async function createSharing(database: Kysely<unknown>): Promise<void> {
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
  // A collaboration room's document: a snapshot in the object store and the updates after it.
  await database.schema
    .createTable('document_room_snapshot')
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('room_epoch', 'integer', required)
    .addColumn('snapshot_object_id', 'uuid', (column) =>
      column.notNull().references('storage_object.id')
    )
    .addColumn('through_sequence', 'integer', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('document_room_snapshot_pkey', ['document_id', 'room_epoch'])
    .execute()
  await database.schema
    .createTable('document_room_update')
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('room_epoch', 'integer', required)
    .addColumn('sequence', 'integer', required)
    .addColumn('data', 'bytea', required)
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('document_room_update_pkey', ['document_id', 'room_epoch', 'sequence'])
    .execute()
  // What someone reported about a shared document, and what an administrator did about it.
  await database.schema
    .createTable('document_report')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('share_id', 'uuid')
    .addColumn('reporter_user_id', 'text')
    .addColumn('reporter_guest_id', 'text')
    .addColumn('reply_email', 'text')
    .addColumn('reason', 'text', required)
    .addColumn('description', 'text', required)
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolved_by', 'text')
    .execute()
}

async function createStorage(database: Kysely<unknown>): Promise<void> {
  // A workspace's images, each stored once; revisions name the ones they use.
  await database.schema
    .createTable('workspace_image')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('checksum', 'text', required)
    .addColumn('storage_object_id', 'uuid', (column) =>
      column.notNull().unique().references('storage_object.id')
    )
    .addColumn('touched_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('workspace_image_pkey', ['workspace_id', 'checksum'])
    .execute()
  await database.schema
    .createTable('revision_image')
    .addColumn('revision_id', 'uuid', (column) =>
      column.notNull().references('document_revision.id').onDelete('cascade')
    )
    .addColumn('name', 'text', required)
    .addColumn('workspace_id', 'uuid', required)
    .addColumn('checksum', 'text', required)
    .addPrimaryKeyConstraint('revision_image_pkey', ['revision_id', 'name'])
    .addForeignKeyConstraint(
      'revision_image_workspace_id_checksum_fkey',
      ['workspace_id', 'checksum'],
      'workspace_image',
      ['workspace_id', 'checksum']
    )
    .execute()
  await database.schema
    .createTable('upload')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('kind', 'text', (column) => column.notNull().defaultTo('revision'))
    .addColumn('base_revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('set null')
    )
    .addColumn('object_key', 'text', (column) => column.notNull().unique())
    .addColumn('status', 'text', required)
    .addColumn('checksum', 'text', required)
    .addColumn('byte_size', 'bigint', required)
    .addColumn('content_type', 'text', required)
    .addColumn('multipart_upload_id', 'text')
    .addColumn('created_by', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('finalization_started_at', 'timestamptz')
    .addColumn('cleanup_claim_id', 'uuid')
    .addColumn('cleanup_claimed_at', 'timestamptz')
    .execute()
  await database.schema
    .createTable('upload_storage_reservation')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('upload_id', 'uuid', (column) =>
      column.notNull().unique().references('upload.id').onDelete('cascade')
    )
    .addColumn('bytes', 'bigint', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('committed_at', 'timestamptz')
    .addColumn('released_at', 'timestamptz')
    .execute()
}

async function createAccounts(database: Kysely<unknown>): Promise<void> {
  // Each invitation sent, for the daily invitation budget; kept apart from the invitations.
  await database.schema
    .createTable('invitation_send')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('sender_id', 'text', required)
    .addColumn('email_normalized', 'text', required)
    .addColumn('sent_at', 'timestamptz', now)
    .execute()
  // The email outbox; a payload is encrypted until it is sent.
  await database.schema
    .createTable('transactional_email')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('idempotency_key', 'text', (column) => column.notNull().unique())
    .addColumn('kind', 'text', required)
    .addColumn('recipient_email_normalized', 'text', required)
    .addColumn('payload_encrypted', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('next_attempt_at', 'timestamptz', now)
    .addColumn('claim_id', 'uuid')
    .addColumn('claimed_at', 'timestamptz')
    .addColumn('transport', 'text')
    .addColumn('transport_message_id', 'text')
    .addColumn('last_error_code', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addColumn('accepted_at', 'timestamptz')
    .execute()
  await database.schema
    .createTable('enrollment')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email_normalized', 'text', (column) => column.notNull().unique())
    .addColumn('name', 'text')
    .addColumn('reason', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('request_revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('requested_at', 'timestamptz', now)
    .addColumn('reviewed_at', 'timestamptz')
    .addColumn('reviewed_by', 'text')
    .addColumn('review_note', 'text')
    .addColumn('approved_user_id', 'text')
    .execute()
  await database.schema
    .createTable('admin_audit_event')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('actor_user_id', 'text', required)
    .addColumn('action', 'text', required)
    .addColumn('subject_type', 'text', required)
    .addColumn('subject_id', 'text', required)
    .addColumn('metadata', 'jsonb', (column) => column.notNull().defaultTo(EMPTY_JSON_OBJECT))
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  // OpenPencil's own rate limits; Better Auth keeps its own in `rate_limit`.
  await database.schema
    .createTable('api_rate_limit')
    .addColumn('key_hash', 'text', (column) => column.primaryKey())
    .addColumn('window_started_at', 'timestamptz', required)
    .addColumn('request_count', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  // The Better Auth schema version this database was built for.
  await database.schema
    .createTable('auth_schema_version')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('version', 'text', required)
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('mfa_assurance')
    .addColumn('session_id', 'uuid', (column) => column.primaryKey())
    .addColumn('user_id', 'uuid', required)
    .addColumn('method', 'text', required)
    .addColumn('verified_at', 'timestamptz', required)
    .execute()
  await database.schema
    .createTable('sign_in')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('user_id', 'uuid', required)
    .addColumn('session_id', 'uuid')
    .addColumn('method', 'text', required)
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('user_picture')
    .addColumn('user_id', 'uuid', (column) => column.primaryKey())
    .addColumn('bytes', 'bytea', required)
    .addColumn('format', 'text', required)
    .addColumn('checksum', 'text', required)
    .addColumn('source', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .execute()
}

export async function up(database: Kysely<unknown>): Promise<void> {
  await createWorkspaces(database)
  await createDocuments(database)
  await createSharing(database)
  await createStorage(database)
  await createAccounts(database)
  for (const [table, column, values] of CHECKS) {
    await database.schema
      .alterTable(table)
      .addCheckConstraint(`${table}_${column}_check`, checkColumnIn(column, values))
      .execute()
  }
  for (const [table, columns] of INDEXES) {
    const name = columns.map((column) => column.split(' ')[0]).join('_')
    await database.schema
      .createIndex(`${table}_${name}_idx`)
      .on(table)
      .columns([...columns])
      .execute()
  }
}

export async function down(database: Kysely<unknown>): Promise<void> {
  for (const table of TABLES.toReversed()) {
    await database.schema.dropTable(table).ifExists().cascade().execute()
  }
}

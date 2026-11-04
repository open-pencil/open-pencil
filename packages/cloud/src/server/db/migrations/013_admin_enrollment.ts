import { checkColumnIn, CURRENT_TIMESTAMP, EMPTY_JSON_OBJECT } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('cloud_enrollment')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email_normalized', 'text', (column) => column.notNull().unique())
    .addColumn('name', 'text')
    .addColumn('reason', 'text')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
    .addColumn('requested_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .addColumn('reviewed_at', 'timestamptz')
    .addColumn('reviewed_by', 'text')
    .addColumn('review_note', 'text')
    .addColumn('approved_user_id', 'text')
    .addCheckConstraint(
      'cloud_enrollment_status_check',
      checkColumnIn('status', ['pending', 'approved', 'rejected', 'revoked'])
    )
    .execute()

  await database.schema
    .createIndex('cloud_enrollment_status_index')
    .on('cloud_enrollment')
    .columns(['status', 'requested_at'])
    .execute()

  await database.schema
    .createTable('cloud_admin_audit_event')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('actor_user_id', 'text', (column) => column.notNull())
    .addColumn('action', 'text', (column) => column.notNull())
    .addColumn('subject_type', 'text', (column) => column.notNull())
    .addColumn('subject_id', 'text', (column) => column.notNull())
    .addColumn('metadata', 'jsonb', (column) => column.notNull().defaultTo(EMPTY_JSON_OBJECT))
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
    .execute()

  await database.schema
    .createIndex('cloud_admin_audit_created_index')
    .on('cloud_admin_audit_event')
    .column('created_at')
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('cloud_admin_audit_event').ifExists().execute()
  await database.schema.dropTable('cloud_enrollment').ifExists().execute()
}

import { type Kysely, sql } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('document_share')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('permission', 'text', (column) => column.notNull())
    .addColumn('secret_hash', 'text', (column) => column.notNull())
    .addColumn('room_epoch', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('last_used_at', 'timestamptz')
    .addCheckConstraint('document_share_permission_check', sql`permission in ('view', 'edit')`)
    .execute()

  await database.schema
    .createTable('document_grant')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('permission', 'text', (column) => column.notNull())
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('revoked_at', 'timestamptz')
    .addUniqueConstraint('document_grant_document_user_unique', ['document_id', 'user_id'])
    .addCheckConstraint('document_grant_permission_check', sql`permission in ('view', 'edit')`)
    .execute()

  await database.schema
    .createTable('document_invitation')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('email_normalized', 'text', (column) => column.notNull())
    .addColumn('permission', 'text', (column) => column.notNull())
    .addColumn('token_hash', 'text', (column) => column.notNull())
    .addColumn('invited_by', 'text', (column) => column.notNull())
    .addColumn('invited_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addCheckConstraint('document_invitation_permission_check', sql`permission in ('view', 'edit')`)
    .execute()

  await database.schema
    .createIndex('document_share_document_index')
    .on('document_share')
    .columns(['document_id', 'revoked_at'])
    .execute()
  await database.schema
    .createIndex('document_grant_user_index')
    .on('document_grant')
    .columns(['user_id', 'document_id'])
    .execute()
  await database.schema
    .createIndex('document_invitation_document_index')
    .on('document_invitation')
    .columns(['document_id', 'revoked_at'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('document_invitation').ifExists().execute()
  await database.schema.dropTable('document_grant').ifExists().execute()
  await database.schema.dropTable('document_share').ifExists().execute()
}

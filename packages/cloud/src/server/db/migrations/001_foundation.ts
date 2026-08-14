import { type Kysely, sql } from 'kysely'

const UPDATED_AT_TRIGGER = 'openpencil_set_updated_at'

export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('workspace')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('slug', 'text', (column) => column.notNull().unique())
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()

  await database.schema
    .createTable('workspace_member')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.references('workspace.id').onDelete('cascade').notNull()
    )
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('role', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('workspace_member_primary', ['workspace_id', 'user_id'])
    .addCheckConstraint('workspace_member_role_check', sql`role in ('admin', 'editor', 'viewer')`)
    .execute()

  await database.schema
    .createTable('document')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('workspace_id', 'uuid', (column) =>
      column.references('workspace.id').onDelete('cascade').notNull()
    )
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('current_revision_id', 'uuid')
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  await database.schema
    .createTable('storage_object')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('object_key', 'text', (column) => column.notNull().unique())
    .addColumn('checksum', 'text', (column) => column.notNull())
    .addColumn('byte_size', 'bigint', (column) => column.notNull())
    .addColumn('content_type', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()

  await database.schema
    .createTable('document_revision')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('parent_revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('set null')
    )
    .addColumn('storage_object_id', 'uuid', (column) =>
      column.references('storage_object.id').onDelete('restrict').notNull()
    )
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()

  await database.schema
    .alterTable('document')
    .addForeignKeyConstraint(
      'document_current_revision_foreign',
      ['current_revision_id'],
      'document_revision',
      ['id'],
      (constraint) => constraint.onDelete('set null')
    )
    .execute()

  await database.schema
    .createTable('upload')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('base_revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('set null')
    )
    .addColumn('object_key', 'text', (column) => column.notNull().unique())
    .addColumn('status', 'text', (column) => column.notNull())
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addCheckConstraint('upload_status_check', sql`status in ('pending', 'committed', 'abandoned')`)
    .execute()

  await database.schema
    .createIndex('workspace_member_user_index')
    .on('workspace_member')
    .column('user_id')
    .execute()
  await database.schema
    .createIndex('document_workspace_index')
    .on('document')
    .columns(['workspace_id', 'updated_at'])
    .execute()
  await database.schema
    .createIndex('document_revision_document_index')
    .on('document_revision')
    .columns(['document_id', 'created_at'])
    .execute()
  await database.schema
    .createIndex('upload_expiration_index')
    .on('upload')
    .columns(['status', 'expires_at'])
    .execute()

  await sql`
    create function ${sql.id(UPDATED_AT_TRIGGER)}() returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `.execute(database)
  for (const table of ['workspace', 'document']) {
    await sql`
      create trigger ${sql.id(`${table}_updated_at`)}
      before update on ${sql.table(table)}
      for each row execute function ${sql.id(UPDATED_AT_TRIGGER)}()
    `.execute(database)
  }
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('upload').ifExists().execute()
  await database.schema
    .alterTable('document')
    .dropConstraint('document_current_revision_foreign')
    .execute()
  await database.schema.dropTable('document_revision').ifExists().execute()
  await database.schema.dropTable('storage_object').ifExists().execute()
  await database.schema.dropTable('document').ifExists().execute()
  await database.schema.dropTable('workspace_member').ifExists().execute()
  await database.schema.dropTable('workspace').ifExists().execute()
  await sql`drop function if exists ${sql.id(UPDATED_AT_TRIGGER)}()`.execute(database)
}

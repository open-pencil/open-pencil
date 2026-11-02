import type { Kysely } from 'kysely'

import { addCheckConstraint, addCurrentTimestampColumns } from './helpers'

/**
 * Images live once per workspace, keyed by the SHA-256 the object store verifies, each a stored
 * object of its own, and a stored revision holds the document without them: each revision lists
 * the images it uses under the names its file gives them. An image upload is an upload of its own
 * kind, so reservations, commits, and expired-upload cleanup cover it.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('upload')
    .addColumn('kind', 'text', (column) => column.notNull().defaultTo('revision'))
    .execute()
  await addCheckConstraint(database, 'upload', 'upload_kind_check', 'kind', ['revision', 'image'])

  await database.schema
    .createTable('workspace_image')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.references('workspace.id').onDelete('cascade').notNull()
    )
    .addColumn('checksum', 'text', (column) => column.notNull())
    .addColumn('storage_object_id', 'uuid', (column) =>
      column.references('storage_object.id').notNull().unique()
    )
    .addPrimaryKeyConstraint('workspace_image_pkey', ['workspace_id', 'checksum'])
    .execute()
  await addCurrentTimestampColumns(database, 'workspace_image', ['touched_at'])

  await database.schema
    .createTable('revision_image')
    .addColumn('revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('cascade').notNull()
    )
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('workspace_id', 'uuid', (column) => column.notNull())
    .addColumn('checksum', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('revision_image_pkey', ['revision_id', 'name'])
    // No cascade: an image is released only once no revision uses it, and a release that raced a
    // save fails rather than taking the revision's images with it.
    .addForeignKeyConstraint(
      'revision_image_image_fkey',
      ['workspace_id', 'checksum'],
      'workspace_image',
      ['workspace_id', 'checksum']
    )
    .execute()
  await database.schema
    .createIndex('revision_image_image_index')
    .on('revision_image')
    .columns(['workspace_id', 'checksum'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('revision_image').execute()
  await database.schema.dropTable('workspace_image').execute()
  await database.schema.alterTable('upload').dropConstraint('upload_kind_check').execute()
  await database.schema.alterTable('upload').dropColumn('kind').execute()
}

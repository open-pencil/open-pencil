import type { Kysely } from 'kysely'

import { addChecks, addIndexes, dropTables, now, required } from './schema'

/** Documents and what they hold: revisions, versions, images, collaboration rooms, and uploads. */
const TABLES = [
  'document',
  'document_revision',
  'document_version',
  'revision_image',
  'document_room_snapshot',
  'document_room_update',
  'upload',
  'upload_storage_reservation'
]

async function createRevisions(database: Kysely<unknown>): Promise<void> {
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
}

async function createRooms(database: Kysely<unknown>): Promise<void> {
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
}

async function createUploads(database: Kysely<unknown>): Promise<void> {
  // A revision or image on its way into the object store, and the space it holds meanwhile.
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

export async function up(database: Kysely<unknown>): Promise<void> {
  await createRevisions(database)
  await createRooms(database)
  await createUploads(database)
  await addChecks(database, [
    ['document', 'kind', ['design', 'board']],
    ['document_version', 'kind', ['checkpoint', 'named']],
    ['upload', 'kind', ['revision', 'image']],
    ['upload', 'status', ['pending', 'finalizing', 'cleaning', 'committed', 'abandoned']]
  ])
  await addIndexes(database, [
    ['document', ['workspace_id', 'updated_at']],
    ['document', ['deleted_at', 'cleanup_claimed_at']],
    ['document_revision', ['document_id', 'created_at']],
    ['document_version', ['document_id', 'created_at desc', 'id desc']],
    ['revision_image', ['workspace_id', 'checksum']],
    ['upload', ['status', 'expires_at']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}

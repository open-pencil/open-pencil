import { checkColumnIn } from '#cloud/server/db/expressions'
import type { CloudDatabase } from '#cloud/server/db/tables'
import type { Kysely } from 'kysely'

import { addCurrentTimestampColumns } from './helpers'

/**
 * A document's version history: the revisions kept as checkpoints or named versions. Saves in
 * between are compacted away, so a version is what keeps a revision and its stored file.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('document_version')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('document_id', 'uuid', (column) =>
      column.references('document.id').onDelete('cascade').notNull()
    )
    .addColumn('revision_id', 'uuid', (column) =>
      column.references('document_revision.id').onDelete('cascade').notNull().unique()
    )
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('name', 'text')
    .addColumn('description', 'text')
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('restored_from_version_id', 'uuid', (column) =>
      column.references('document_version.id').onDelete('set null')
    )
    .addCheckConstraint(
      'document_version_kind_check',
      checkColumnIn('kind', ['checkpoint', 'named'])
    )
    .execute()
  await addCurrentTimestampColumns(database, 'document_version', ['created_at'])
  await database.schema
    .createIndex('document_version_document_index')
    .on('document_version')
    .columns(['document_id', 'created_at desc', 'id desc'])
    .execute()
  // History starts with what each document holds now.
  await keepCurrentRevisions(database as Kysely<CloudDatabase>)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('document_version').execute()
}

/** Keeps each document's current revision as the first checkpoint of its history. */
export async function keepCurrentRevisions(database: Kysely<CloudDatabase>): Promise<void> {
  await database
    .insertInto('documentVersion')
    .columns(['id', 'documentId', 'revisionId', 'kind', 'createdBy', 'createdAt'])
    .expression((expression) =>
      expression
        .selectFrom('document')
        .innerJoin('documentRevision', 'documentRevision.id', 'document.currentRevisionId')
        .select((select) => [
          select.fn<string>('gen_random_uuid').as('id'),
          'document.id as documentId',
          'documentRevision.id as revisionId',
          select.val('checkpoint').as('kind'),
          'documentRevision.createdBy',
          'documentRevision.createdAt'
        ])
    )
    .execute()
}

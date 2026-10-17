import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { keepCurrentRevisions } from '#cloud/server/db/migrations/021_document_versions'

describe('migration 021', () => {
  test('starts each document’s history with its current revision', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const { database } = runtime
      const workspaceId = crypto.randomUUID()
      const saved = crypto.randomUUID()
      const empty = crypto.randomUUID()
      const objectId = crypto.randomUUID()
      const revisionId = crypto.randomUUID()
      const savedAt = new Date('2026-09-01T12:00:00.000Z')
      await database
        .insertInto('workspace')
        .values({ id: workspaceId, name: 'Studio', slug: 'studio', createdBy: 'alice' })
        .execute()
      await database
        .insertInto('document')
        .values([
          { id: saved, workspaceId, name: 'Poster', createdBy: 'alice' },
          { id: empty, workspaceId, name: 'Blank', createdBy: 'alice' }
        ])
        .execute()
      await database
        .insertInto('storageObject')
        .values({
          id: objectId,
          objectKey: 'documents/poster.fig',
          checksum: `${'A'.repeat(43)}=`,
          byteSize: 128,
          contentType: 'application/octet-stream'
        })
        .execute()
      await database
        .insertInto('documentRevision')
        .values({
          id: revisionId,
          documentId: saved,
          parentRevisionId: null,
          storageObjectId: objectId,
          createdBy: 'bob',
          createdAt: savedAt
        })
        .execute()
      await database
        .updateTable('document')
        .set({ currentRevisionId: revisionId })
        .where('id', '=', saved)
        .execute()

      await keepCurrentRevisions(database)

      const versions = await database
        .selectFrom('documentVersion')
        .select(['documentId', 'revisionId', 'kind', 'createdBy', 'createdAt'])
        .execute()
      expect(versions).toEqual([
        { documentId: saved, revisionId, kind: 'checkpoint', createdBy: 'bob', createdAt: savedAt }
      ])
    } finally {
      await runtime.close()
    }
  })
})

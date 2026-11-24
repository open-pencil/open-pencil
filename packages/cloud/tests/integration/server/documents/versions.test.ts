import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_FEATURE_KEYS,
  createBetterAuthAdapter,
  createCollaborationStateStore,
  createCloudApp,
  createDefaultCloudPolicy,
  createRevisionCompactionService,
  EntitlementOpenFeatureProvider,
  parseCloudServerConfig,
  StaticEntitlementSource,
  type CloudActor
} from '#cloud/server'
import { testClient } from 'hono/testing'
import * as v from 'valibot'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

const alice: CloudActor = { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
const DAY_MS = 24 * 60 * 60_000
const FILE_BYTES = 128

async function testApp(options: { fullHistory?: boolean } = {}) {
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const policy =
    options.fullHistory === false
      ? createDefaultCloudPolicy(
          new EntitlementOpenFeatureProvider(
            new StaticEntitlementSource({ [CLOUD_FEATURE_KEYS.revisionHistory]: false })
          )
        )
      : undefined
  const restoredDocuments: string[] = []
  /** Each time the server told the document's rooms its history changed. */
  const announcements: string[] = []
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    policy,
    resolveSession: async () => alice,
    onDocumentRestored: (documentId) => restoredDocuments.push(documentId),
    onDocumentVersionsChanged: (documentId) => announcements.push(documentId)
  })
  const client = testClient(app)
  const api = contractClient(app)
  const workspace = await responseJSON(
    await client.api.workspaces.$post({ json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const created = await api.documents.create({
    params: { workspaceId: workspace.workspace.id },
    body: { name: 'Poster' }
  })
  const documentId = created.document.id
  let saves = 0
  let current: string | null = null

  /** Saves the document the way the editor does: an upload, then its commit. */
  async function save(): Promise<string> {
    saves++
    const checksum = `${String.fromCharCode(64 + saves).repeat(43)}=`
    const upload = await api.documents.createUpload({
      params: { documentId },
      body: {
        baseRevisionId: current,
        byteSize: FILE_BYTES,
        checksum,
        contentType: 'application/octet-stream'
      }
    })
    const row = await runtime.database
      .selectFrom('upload')
      .select('objectKey')
      .where('id', '=', upload.id)
      .executeTakeFirstOrThrow()
    objects.put(row.objectKey, {
      byteSize: FILE_BYTES,
      checksum,
      checksumVerification: 'native',
      contentType: 'application/octet-stream'
    })
    const committed = await api.documents.commitUpload({
      params: { uploadId: upload.id },
      body: { checksum }
    })
    current = committed.document.currentRevisionId
    if (!current) throw new Error('The save left no revision')
    return current
  }

  /** Moves the whole history back in time, as if it were made that long ago. */
  async function age(milliseconds: number) {
    // Stored files are as old as the saves that wrote them.
    for (const table of ['documentVersion', 'documentRevision', 'storageObject'] as const) {
      const rows = await runtime.database.selectFrom(table).select(['id', 'createdAt']).execute()
      for (const row of rows) {
        await runtime.database
          .updateTable(table)
          .set({ createdAt: new Date(row.createdAt.getTime() - milliseconds) })
          .where('id', '=', row.id)
          .execute()
      }
    }
  }

  async function history() {
    return api.versions.list({ params: { documentId }, query: {} })
  }

  return {
    runtime,
    restoredDocuments,
    announcements,
    objects,
    policy,
    api,
    workspaceId: workspace.workspace.id,
    documentId,
    save,
    age,
    history,
    current: () => current
  }
}

describe('Cloud version history', () => {
  test('keeps the first save, and the state each half hour of editing ends on', async () => {
    const context = await testApp()
    try {
      const first = await context.save()
      await context.save()
      const ended = await context.save()
      expect((await context.history()).versions.map((version) => version.revisionId)).toEqual([
        first
      ])
      // Only saves that add a checkpoint change the history open lists show.
      expect(context.announcements).toEqual([context.documentId])

      // Half an hour on, the next save keeps the state it replaces.
      await context.age(31 * 60_000)
      const latest = await context.save()
      expect(context.announcements).toHaveLength(2)
      const { versions } = await context.history()
      expect(versions.map((version) => version.revisionId)).toEqual([ended, first])
      expect(versions.every((version) => version.kind === 'checkpoint')).toBe(true)
      expect(versions.some((version) => version.current)).toBe(false)
      expect(latest).not.toBe(ended)
    } finally {
      await context.runtime.close()
    }
  })

  test('names the current state, and deleting its info leaves a checkpoint', async () => {
    const context = await testApp()
    try {
      await context.save()
      const current = await context.save()
      const named = await context.api.versions.save({
        params: { documentId: context.documentId },
        body: { name: 'Hand-off', description: 'Ready for review' }
      })
      expect(named.version).toMatchObject({
        revisionId: current,
        kind: 'named',
        name: 'Hand-off',
        description: 'Ready for review',
        current: true,
        createdBy: { id: 'alice' }
      })

      const cleared = await context.api.versions.update({
        params: { documentId: context.documentId, versionId: named.version.id },
        body: { name: null }
      })
      expect(cleared.version).toMatchObject({ kind: 'checkpoint', name: null, description: null })
      expect((await context.history()).versions).toHaveLength(2)
      // The first save's checkpoint, the name, and taking it away.
      expect(context.announcements).toHaveLength(3)

      expect(
        await outcome(
          context.api.versions.save({
            params: { documentId: context.documentId },
            body: { name: '   ' }
          })
        )
      ).toMatchObject({ status: 400 })
    } finally {
      await context.runtime.close()
    }
  })

  test('restores a version without losing the state it replaces', async () => {
    const context = await testApp()
    try {
      const first = await context.save()
      const replaced = await context.save()
      const [original] = (await context.history()).versions
      if (!original) throw new Error('No first version')
      const before = await context.runtime.database
        .selectFrom('document')
        .select('collaborationEpoch')
        .where('id', '=', context.documentId)
        .executeTakeFirstOrThrow()
      // What the relay saved of the live room, which the restore replaces.
      const rooms = createCollaborationStateStore(context.runtime.database, context.objects.store)
      const room = { documentId: context.documentId, roomEpoch: before.collaborationEpoch }
      await rooms.compact(room, 0, Uint8Array.from([1]))
      await rooms.append(room, 1, Uint8Array.from([2]))

      const restored = await context.api.versions.restore({
        params: { documentId: context.documentId, versionId: original.id }
      })
      expect(restored.version).toMatchObject({ current: true, restoredFromVersionId: original.id })
      const restoredRevision = restored.document.currentRevisionId
      if (!restoredRevision) throw new Error('The restore left no revision')
      expect([first, replaced]).not.toContain(restoredRevision)
      expect((await context.history()).versions.map((version) => version.revisionId)).toEqual([
        restoredRevision,
        replaced,
        first
      ])

      // Everyone in the live room starts over on the restored version.
      const after = await context.runtime.database
        .selectFrom('document')
        .select('collaborationEpoch')
        .where('id', '=', context.documentId)
        .executeTakeFirstOrThrow()
      expect(after.collaborationEpoch).toBe(before.collaborationEpoch + 1)
      expect(context.restoredDocuments).toEqual([context.documentId])
      // The replaced room never opens again, so nothing the relay saved of it is kept.
      expect(await rooms.load(room)).toEqual({ snapshot: null, updates: [], sequence: 0 })

      // The restored state is the same stored file, so it opens as the original and costs nothing.
      const [restoredDownload, originalDownload] = await Promise.all(
        [restored.version.id, original.id].map((versionId) =>
          context.api.versions.download({
            params: { documentId: context.documentId, versionId }
          })
        )
      )
      expect(restoredDownload?.document.download.url).toBe(originalDownload?.document.download.url)
      // Each comes with its version, so a link to one can show it without the history.
      expect(originalDownload?.version.id).toBe(original.id)
      const usage = await context.runtime.database
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .where('workspaceId', '=', context.workspaceId)
        .executeTakeFirstOrThrow()
      expect(Number(usage.committedBytes)).toBe(2 * FILE_BYTES)
    } finally {
      await context.runtime.close()
    }
  })

  test('duplicates a version into a new document with a history of its own', async () => {
    const context = await testApp()
    try {
      await context.save()
      const [version] = (await context.history()).versions
      if (!version) throw new Error('No version')
      const copy = await context.api.versions.duplicate({
        params: { documentId: context.documentId, versionId: version.id },
        body: { name: 'Poster copy' }
      })
      expect(copy.document.id).not.toBe(context.documentId)
      const copied = await context.api.versions.list({
        params: { documentId: copy.document.id },
        query: {}
      })
      expect(copied.versions).toHaveLength(1)
      expect(copied.versions[0]?.current).toBe(true)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses to duplicate a version of a deleted document', async () => {
    const context = await testApp()
    try {
      await context.save()
      const [version] = (await context.history()).versions
      if (!version) throw new Error('No version')
      await context.api.documents.remove({ params: { documentId: context.documentId } })
      expect(
        await outcome(
          context.api.versions.duplicate({
            params: { documentId: context.documentId, versionId: version.id },
            body: { name: 'Poster copy' }
          })
        )
      ).toMatchObject({ status: 404 })
    } finally {
      await context.runtime.close()
    }
  })

  test('pages through a long history, newest first', async () => {
    const context = await testApp()
    try {
      for (let index = 0; index < 4; index++) {
        await context.save()
        await context.age(31 * 60_000)
      }
      const first = await context.api.versions.list({
        params: { documentId: context.documentId },
        query: { limit: '2' }
      })
      expect(first.versions).toHaveLength(2)
      if (!first.nextCursor) throw new Error('Expected another page')
      const second = await context.api.versions.list({
        params: { documentId: context.documentId },
        query: { limit: '2', before: first.nextCursor }
      })
      const all = (await context.history()).versions.map((version) => version.id)
      expect([...first.versions, ...second.versions].map((version) => version.id)).toEqual(
        all.slice(0, first.versions.length + second.versions.length)
      )
    } finally {
      await context.runtime.close()
    }
  })
})

describe('Cloud revision compaction', () => {
  test('deletes the saves between versions once they are old, and returns their bytes', async () => {
    const context = await testApp()
    try {
      const first = await context.save()
      await context.save()
      await context.save()
      const current = await context.save()
      await context.age(2 * DAY_MS)

      const result = await createRevisionCompactionService(
        context.runtime.database,
        context.objects.store
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(result).toMatchObject({
        revisionsDeleted: 2,
        objectsDeleted: 2,
        bytesReclaimed: 2 * FILE_BYTES,
        failed: 0
      })
      const kept = await context.runtime.database
        .selectFrom('documentRevision')
        .select('id')
        .execute()
      expect(kept.map((revision) => revision.id).sort()).toEqual([first, current].sort())
      const usage = await context.runtime.database
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .where('workspaceId', '=', context.workspaceId)
        .executeTakeFirstOrThrow()
      expect(Number(usage.committedBytes)).toBe(2 * FILE_BYTES)
    } finally {
      await context.runtime.close()
    }
  })

  test('deletes no more saves in one pass than its batch allows', async () => {
    const context = await testApp()
    try {
      for (let index = 0; index < 7; index++) await context.save()
      await context.age(2 * DAY_MS)
      const compaction = createRevisionCompactionService(
        context.runtime.database,
        context.objects.store
      )
      const passes = []
      for (let index = 0; index < 3; index++) {
        passes.push(
          (await compaction.compactRevisions({ batchSize: 2, graceMs: DAY_MS })).revisionsDeleted
        )
      }
      expect(passes).toEqual([2, 2, 1])
    } finally {
      await context.runtime.close()
    }
  })

  test('tries a file again when the object store failed to delete it', async () => {
    const context = await testApp()
    try {
      await context.save()
      await context.save()
      await context.save()
      await context.age(2 * DAY_MS)
      const failing = {
        ...context.objects.store,
        delete: async () => {
          throw new Error('The object store is unavailable')
        }
      }
      const first = await createRevisionCompactionService(
        context.runtime.database,
        failing
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(first).toMatchObject({ revisionsDeleted: 1, objectsDeleted: 0, failed: 1 })
      expect(first.bytesReclaimed).toBe(FILE_BYTES)

      const second = await createRevisionCompactionService(
        context.runtime.database,
        context.objects.store
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(second).toMatchObject({ revisionsDeleted: 0, objectsDeleted: 1, failed: 0 })
      const rows = await context.runtime.database.selectFrom('storageObject').select('id').execute()
      expect(rows).toHaveLength(2)
    } finally {
      await context.runtime.close()
    }
  })

  test('leaves recent saves alone', async () => {
    const context = await testApp()
    try {
      await context.save()
      await context.save()
      await context.save()
      const result = await createRevisionCompactionService(
        context.runtime.database,
        context.objects.store
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(result.revisionsDeleted).toBe(0)
    } finally {
      await context.runtime.close()
    }
  })

  test('a workspace without full history keeps 30 days of versions', async () => {
    const context = await testApp({ fullHistory: false })
    try {
      await context.save()
      await context.age(40 * DAY_MS)
      const recent = await context.save()
      await context.age(31 * 60_000)
      await context.save()
      expect((await context.history()).versions.map((version) => version.revisionId)).toEqual([
        recent
      ])

      const result = await createRevisionCompactionService(
        context.runtime.database,
        context.objects.store,
        { policy: context.policy }
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(result.versionsPruned).toBe(1)
      expect(result.revisionsDeleted).toBe(1)
    } finally {
      await context.runtime.close()
    }
  })
})

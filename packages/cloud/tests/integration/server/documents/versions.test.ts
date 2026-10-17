import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_FEATURE_KEYS,
  createBetterAuthAdapter,
  createCloudApp,
  createDefaultCloudPolicy,
  createRevisionCompactionService,
  EntitlementOpenFeatureProvider,
  parseCloudServerConfig,
  StaticEntitlementSource,
  type CloudActor
} from '#cloud/server'
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

const versionSchema = v.object({
  id: v.string(),
  revisionId: v.string(),
  kind: v.picklist(['checkpoint', 'named']),
  name: v.nullable(v.string()),
  description: v.nullable(v.string()),
  current: v.boolean(),
  restoredFromVersionId: v.nullable(v.string()),
  createdBy: v.object({ id: v.string(), name: v.nullable(v.string()) })
})
const versionsSchema = v.object({
  versions: v.array(versionSchema),
  nextCursor: v.nullable(v.string())
})
const documentSchema = v.object({
  document: v.object({ id: v.string(), currentRevisionId: v.nullable(v.string()) })
})

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
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    policy,
    resolveSession: async () => alice
  })
  const request = (path: string, init: { method?: string; json?: unknown } = {}) =>
    app.request(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init.json === undefined ? undefined : JSON.stringify(init.json)
    })
  const workspace = await responseJSON(
    await request('/workspaces', { method: 'POST', json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const created = await responseJSON(
    await request(`/workspaces/${workspace.workspace.id}/documents`, {
      method: 'POST',
      json: { name: 'Poster' }
    }),
    documentSchema
  )
  const documentId = created.document.id
  let saves = 0
  let current: string | null = null

  /** Saves the document the way the editor does: an upload, then its commit. */
  async function save(): Promise<string> {
    saves++
    const checksum = `${String.fromCharCode(64 + saves).repeat(43)}=`
    const upload = await responseJSON(
      await request(`/documents/${documentId}/uploads`, {
        method: 'POST',
        json: {
          baseRevisionId: current,
          byteSize: FILE_BYTES,
          checksum,
          contentType: 'application/octet-stream'
        }
      }),
      v.object({ id: v.string() })
    )
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
    const committed = await responseJSON(
      await request(`/uploads/${upload.id}/commit`, { method: 'POST', json: { checksum } }),
      documentSchema
    )
    current = committed.document.currentRevisionId
    if (!current) throw new Error('The save left no revision')
    return current
  }

  /** Moves the whole history back in time, as if it were made that long ago. */
  async function age(milliseconds: number) {
    for (const table of ['documentVersion', 'documentRevision'] as const) {
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
    return responseJSON(await request(`/documents/${documentId}/versions`), versionsSchema)
  }

  return {
    runtime,
    objects,
    policy,
    request,
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

      // Half an hour on, the next save keeps the state it replaces.
      await context.age(31 * 60_000)
      const latest = await context.save()
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
      const named = await responseJSON(
        await context.request(`/documents/${context.documentId}/versions`, {
          method: 'POST',
          json: { name: 'Hand-off', description: 'Ready for review' }
        }),
        v.object({ version: versionSchema })
      )
      expect(named.version).toMatchObject({
        revisionId: current,
        kind: 'named',
        name: 'Hand-off',
        description: 'Ready for review',
        current: true,
        createdBy: { id: 'alice' }
      })

      const cleared = await responseJSON(
        await context.request(`/documents/${context.documentId}/versions/${named.version.id}`, {
          method: 'PATCH',
          json: { name: null }
        }),
        v.object({ version: versionSchema })
      )
      expect(cleared.version).toMatchObject({ kind: 'checkpoint', name: null, description: null })
      expect((await context.history()).versions).toHaveLength(2)

      const empty = await context.request(`/documents/${context.documentId}/versions`, {
        method: 'POST',
        json: { name: '   ' }
      })
      expect(empty.status).toBe(400)
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

      const restored = await responseJSON(
        await context.request(`/documents/${context.documentId}/versions/${original.id}/restore`, {
          method: 'POST'
        }),
        v.object({
          document: v.object({ currentRevisionId: v.string() }),
          version: versionSchema
        })
      )
      expect(restored.version).toMatchObject({ current: true, restoredFromVersionId: original.id })
      expect([first, replaced]).not.toContain(restored.document.currentRevisionId)
      expect((await context.history()).versions.map((version) => version.revisionId)).toEqual([
        restored.document.currentRevisionId,
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

      // The restored state is the same stored file, so it opens as the original and costs nothing.
      const [restoredDownload, originalDownload] = await Promise.all(
        [restored.version.id, original.id].map(async (versionId) =>
          responseJSON(
            await context.request(`/documents/${context.documentId}/versions/${versionId}`),
            v.object({ document: v.object({ download: v.object({ url: v.string() }) }) })
          )
        )
      )
      expect(restoredDownload?.document.download.url).toBe(originalDownload?.document.download.url)
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
      const copy = await responseJSON(
        await context.request(`/documents/${context.documentId}/versions/${version.id}/duplicate`, {
          method: 'POST',
          json: { name: 'Poster copy' }
        }),
        documentSchema
      )
      expect(copy.document.id).not.toBe(context.documentId)
      const copied = await responseJSON(
        await context.request(`/documents/${copy.document.id}/versions`),
        versionsSchema
      )
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
      await context.request(`/documents/${context.documentId}`, { method: 'DELETE' })
      const copy = await context.request(
        `/documents/${context.documentId}/versions/${version.id}/duplicate`,
        { method: 'POST', json: { name: 'Poster copy' } }
      )
      expect(copy.status).toBe(404)
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
      const first = await responseJSON(
        await context.request(`/documents/${context.documentId}/versions?limit=2`),
        versionsSchema
      )
      expect(first.versions).toHaveLength(2)
      if (!first.nextCursor) throw new Error('Expected another page')
      const second = await responseJSON(
        await context.request(
          `/documents/${context.documentId}/versions?limit=2&before=${first.nextCursor}`
        ),
        versionsSchema
      )
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

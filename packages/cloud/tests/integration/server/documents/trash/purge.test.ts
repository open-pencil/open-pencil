import { describe, expect, test } from 'bun:test'

import { DAY_MS, people, trashApp } from '#cloud-tests/helpers/trash'
import { AdminDomainError, createAdminDocumentService } from '#cloud/admin'
import {
  createDocumentCleanupService,
  type CloudErrorContext,
  type CloudErrorReporter
} from '#cloud/server'

const GRACE_MS = 7 * DAY_MS
const RETENTION_MS = 30 * DAY_MS

/** A reporter that keeps what it was sent. */
function recordingReporter() {
  const reports: { error: unknown; context: CloudErrorContext }[] = []
  const reporter: CloudErrorReporter = async (error, context) => {
    reports.push({ error, context })
  }
  return { reports, reporter }
}

/** A cleanup pass at `now`, with the deployment's default retention and grace. */
function cleanupAt(context: Awaited<ReturnType<typeof trashApp>>, now: Date) {
  return createDocumentCleanupService(
    context.runtime.database,
    context.objects.store
  ).cleanupDeletedDocuments({
    batchSize: 10,
    leaseDurationMs: 60_000,
    retentionMs: RETENTION_MS,
    purgeGraceMs: GRACE_MS,
    now
  })
}

function restoreAsAdmin(
  context: Awaited<ReturnType<typeof trashApp>>,
  documentId: string,
  now?: Date
) {
  return createAdminDocumentService(context.runtime.database, {
    purgeGraceMs: GRACE_MS
  }).undelete('server-admin', documentId, now)
}

/** The code an administrator's restore was refused with, or null when it went through. */
function refusal(context: Awaited<ReturnType<typeof trashApp>>, documentId: string, now?: Date) {
  return restoreAsAdmin(context, documentId, now).then(
    () => null,
    (error: unknown) => (error instanceof AdminDomainError ? error.code : error)
  )
}

describe('Deleting forever', () => {
  test('takes a document out of Trash and off storage, and keeps its files through the grace', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Heavy')
      await context.withRevision(document)
      await context.remove(document)
      expect(await context.usage()).toBe(128)

      expect((await context.purge(document)).status).toBe(204)
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
      expect((await context.purge(document)).status).toBe(404)
      expect(await context.usage()).toBe(0)
      expect(context.objects.deletedKeys).toEqual([])
      expect(await context.row(document)).toMatchObject({
        purgedBy: people.alice.userId,
        purgedBytes: expect.anything()
      })

      // Still inside its grace, even past its time in Trash, cleanup leaves it.
      const deletedAt = Date.now()
      expect(await cleanupAt(context, new Date(deletedAt + 6 * DAY_MS))).toMatchObject({
        claimed: 0
      })
      expect(await cleanupAt(context, new Date(deletedAt + 8 * DAY_MS))).toMatchObject({
        claimed: 1,
        cleaned: 1,
        failed: 0
      })
      expect(context.objects.deletedKeys).toHaveLength(1)
      expect(await context.row(document)).toBeUndefined()
      // Its bytes came off when it was deleted forever, and only then.
      expect(await context.usage()).toBe(0)
    } finally {
      await context.runtime.close()
    }
  })

  test('waits out the grace even when Trash time ran out first', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Old')
      await context.remove(document)
      await context.deletedAgo(document, 29 * DAY_MS)
      expect((await context.purge(document)).status).toBe(204)

      const purgedAt = Date.now()
      expect(await cleanupAt(context, new Date(purgedAt + 2 * DAY_MS))).toMatchObject({
        claimed: 0
      })
      expect(await cleanupAt(context, new Date(purgedAt + 8 * DAY_MS))).toMatchObject({
        cleaned: 1
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('destroys the document in the request when the grace is 0', async () => {
    const context = await trashApp({ purgeGraceMs: 0 })
    try {
      const document = await context.create('Gone')
      const objectKey = await context.withRevision(document)
      await context.remove(document)

      expect((await context.purge(document)).status).toBe(204)
      expect(context.objects.deletedKeys).toEqual([objectKey])
      expect(await context.row(document)).toBeUndefined()
      expect(await context.usage()).toBe(0)
      expect((await context.restore(document)).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('reports a failed destroy once, from cleanup, and keeps the document out of Trash', async () => {
    const { reports, reporter } = recordingReporter()
    const context = await trashApp({ purgeGraceMs: 0, reportError: reporter })
    try {
      const document = await context.create('Half gone')
      await context.withRevision(document, 'first')
      await context.withRevision(document, 'second')
      await context.remove(document)
      const store = context.objects.store
      const remove = store.delete.bind(store)
      const failure = new Error('The object store went down')
      let deletes = 0
      store.delete = async (key) => {
        deletes++
        if (deletes > 1) throw failure
        await remove(key)
      }

      const response = await context.purge(document)
      expect(response.status).toBe(503)
      expect(reports).toHaveLength(1)
      expect(reports[0]?.error).toBe(failure)
      expect(reports[0]?.context).toEqual({
        source: 'cleanup',
        message: expect.stringMatching(/^Cleaning up document [0-9a-f-]{36} failed$/)
      })
      expect(context.objects.deletedKeys).toHaveLength(1)
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
      expect(await context.usage()).toBe(0)

      // The next pass finishes the job, taking nothing more off the usage.
      store.delete = remove
      expect(
        await createDocumentCleanupService(context.runtime.database, store).cleanupDeletedDocuments(
          {
            batchSize: 10,
            leaseDurationMs: 0,
            retentionMs: RETENTION_MS,
            purgeGraceMs: 0
          }
        )
      ).toMatchObject({ cleaned: 1, failed: 0 })
      expect(await context.row(document)).toBeUndefined()
      expect(await context.usage()).toBe(0)
    } finally {
      await context.runtime.close()
    }
  })

  test('lets a server administrator bring a document back within the grace', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Rescued')
      await context.withRevision(document)
      await context.remove(document)
      await context.purge(document)
      const admin = createAdminDocumentService(context.runtime.database, {
        purgeGraceMs: GRACE_MS
      })

      const purged = await admin.list({ filter: 'purged' })
      expect(purged.documents.map((entry) => entry.id)).toEqual([document])
      expect(purged.counts).toMatchObject({ all: 0, purged: 1 })
      const [listed] = purged.documents
      if (!listed?.purgedAt || !listed.destroyedAt) throw new Error('Expected a grace')
      expect(Date.parse(listed.destroyedAt) - Date.parse(listed.purgedAt)).toBe(GRACE_MS)

      await admin.undelete('server-admin', document)
      expect(await context.listed()).toEqual([document])
      expect(await context.trash()).toEqual([])
      expect(await context.usage()).toBe(128)
      expect(await context.row(document)).toMatchObject({
        deletedAt: null,
        purgedAt: null,
        purgedBy: null
      })
      const audit = await context.runtime.database
        .selectFrom('adminAuditEvent')
        .select(['actorUserId', 'action', 'subjectType', 'subjectId'])
        .execute()
      expect(audit).toEqual([
        {
          actorUserId: 'server-admin',
          action: 'document.undeleted',
          subjectType: 'document',
          subjectId: document
        }
      ])
      expect((await admin.list({ filter: 'purged' })).documents).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses to bring back a document past its grace, still in Trash, or left without members', async () => {
    const context = await trashApp()
    try {
      const expired = await context.create('Expired')
      const trashed = await context.create('Trashed')
      const orphaned = await context.create('Orphaned')
      for (const document of [expired, trashed, orphaned]) await context.remove(document)
      await context.purge(expired)
      await context.runtime.database
        .updateTable('document')
        .set({ purgedAt: new Date(Date.now() - GRACE_MS - 60_000) })
        .where('id', '=', expired)
        .execute()

      expect(await refusal(context, expired)).toBe('document_not_restorable')
      expect(await refusal(context, trashed)).toBe('document_not_restorable')

      await context.purge(orphaned)
      await context.runtime.database
        .deleteFrom('workspaceMember')
        .where('workspaceId', '=', context.workspaceId)
        .execute()
      expect(await refusal(context, orphaned)).toBe('workspace_gone')
    } finally {
      await context.runtime.close()
    }
  })

  test('restores up to the end of the grace, not after it or while cleanup holds the document', async () => {
    const context = await trashApp()
    try {
      const inside = await context.create('Inside')
      const claimed = await context.create('Claimed')
      for (const document of [inside, claimed]) {
        await context.remove(document)
        await context.purge(document)
      }
      const { purgedAt } = await context.runtime.database
        .selectFrom('document')
        .select('purgedAt')
        .where('id', '=', inside)
        .executeTakeFirstOrThrow()
      if (!purgedAt) throw new Error('Expected it deleted forever')
      const cutoff = new Date(new Date(purgedAt).getTime() + GRACE_MS)

      expect(await refusal(context, inside, cutoff)).toBe('document_not_restorable')
      expect(await refusal(context, inside, new Date(cutoff.getTime() - 1))).toBeNull()

      await context.runtime.database
        .updateTable('document')
        .set({ cleanupClaimId: crypto.randomUUID(), cleanupClaimedAt: new Date() })
        .where('id', '=', claimed)
        .execute()
      expect(await refusal(context, claimed)).toBe('document_not_restorable')

      // Destroyed since the console listed it.
      await context.runtime.database.deleteFrom('document').where('id', '=', claimed).execute()
      expect(await refusal(context, claimed)).toBe('document_not_restorable')
    } finally {
      await context.runtime.close()
    }
  })

  test('lets only the owner or a workspace admin delete forever', async () => {
    const context = await trashApp({ roles: { bob: 'editor' } })
    try {
      const document = await context.create('Alice’s')
      await context.remove(document)
      context.as('bob')
      expect((await context.purge(document)).status).toBe(403)
      expect(await context.row(document)).toMatchObject({ purgedAt: null })
    } finally {
      await context.runtime.close()
    }
  })
})

describe('Cleanup failures', () => {
  test('are reported once each, from cleanup, by document ID only', async () => {
    const { reports, reporter } = recordingReporter()
    const context = await trashApp()
    try {
      const document = await context.create('Stuck')
      await context.withRevision(document)
      await context.remove(document)
      await context.deletedAgo(document, RETENTION_MS + 60_000)
      const failure = new Error('The object store is down')
      context.objects.store.delete = async () => {
        throw failure
      }

      const result = await createDocumentCleanupService(
        context.runtime.database,
        context.objects.store,
        { reportError: reporter }
      ).cleanupDeletedDocuments({
        batchSize: 10,
        leaseDurationMs: 60_000,
        retentionMs: RETENTION_MS,
        purgeGraceMs: GRACE_MS
      })
      expect(result).toMatchObject({ claimed: 1, cleaned: 0, failed: 1 })
      expect(reports).toEqual([
        {
          error: failure,
          context: {
            source: 'cleanup',
            message: expect.stringMatching(/^Cleaning up document [0-9a-f-]{36} failed$/)
          }
        }
      ])
      // Released, so the next pass tries again.
      expect(await context.row(document)).toBeDefined()
      expect(
        (
          await context.runtime.database
            .selectFrom('document')
            .select('cleanupClaimId')
            .where('id', '=', document)
            .executeTakeFirstOrThrow()
        ).cleanupClaimId
      ).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })
})

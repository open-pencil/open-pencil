import type {
  DocumentVersionDownload,
  DocumentSummary,
  DocumentVersion,
  DocumentVersions,
  DuplicateDocumentVersionInput,
  SaveDocumentVersionInput,
  UpdateDocumentVersionInput
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { canEditDocument, resolveDocumentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import { copyRevisionImages, revisionImageDownloads } from '#cloud/server/documents/images'
import { findDocument, insertDocument, workspaceRole } from '#cloud/server/documents/repository'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import type { ObjectStore } from '#cloud/server/objects'
import type { CloudPolicyContext } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely, Transaction } from 'kysely'

import { announceVersions, keepRevision } from './checkpoint'
import { historyStart } from './history'

const DOWNLOAD_LIFETIME_MS = 5 * 60 * 1000
const DEFAULT_PAGE_SIZE = 50
const MAXIMUM_PAGE_SIZE = 100
const WRITABLE_ROLES = new Set(['admin', 'editor'])

type VersionRow = {
  id: string
  revisionId: string
  kind: 'checkpoint' | 'named'
  name: string | null
  description: string | null
  createdAt: Date
  createdBy: string
  createdByName: string | null
  restoredFromVersionId: string | null
}

function versionOf(row: VersionRow, currentRevisionId: string | null): DocumentVersion {
  return {
    id: row.id,
    revisionId: row.revisionId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    createdBy: { id: row.createdBy, name: row.createdByName },
    restoredFromVersionId: row.restoredFromVersionId,
    current: row.revisionId === currentRevisionId
  }
}

/**
 * A document's version history: its checkpoints and named versions, newest first, and what can be
 * done with one. Anyone who can open the document sees its history; editors name and restore.
 */
export function createDocumentVersionService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  options: {
    policy?: CloudPolicy
    deploymentMode?: CloudPolicyContext['deploymentMode']
    /** Called once a restore lands, so the document's live room starts over. */
    onRestored?: (documentId: string) => void
    /** Called once the history changes: a version named, renamed, or turned back into an autosave. */
    onVersionsChanged?: (documentId: string) => void
  } = {}
) {
  const deploymentMode = options.deploymentMode ?? 'self-hosted'
  function versions() {
    return database
      .selectFrom('documentVersion')
      .leftJoin('user', (join) =>
        join.on((expression) =>
          expression(
            expression.cast(expression.ref('user.id'), 'text'),
            '=',
            expression.ref('documentVersion.createdBy')
          )
        )
      )
      .select([
        'documentVersion.id',
        'documentVersion.revisionId',
        'documentVersion.kind',
        'documentVersion.name',
        'documentVersion.description',
        'documentVersion.createdAt',
        'documentVersion.createdBy',
        'user.name as createdByName',
        'documentVersion.restoredFromVersionId'
      ])
  }

  /** The document the person may see the history of, and where that history starts. */
  async function openHistory(userId: string, documentId: string, edit: boolean) {
    const access = await resolveDocumentAccess(database, userId, documentId)
    if (!access) throw new DocumentNotFoundError()
    if (edit && !canEditDocument(access)) throw new DocumentForbiddenError()
    const document = await getDocumentSummaryRow(database, documentId)
    if (!document) throw new DocumentNotFoundError()
    return {
      document,
      start: await historyStart(options.policy, deploymentMode, document.workspaceId, new Date())
    }
  }

  async function findVersion(documentId: string, versionId: string, start: Date | null) {
    let query = versions()
      .where('documentVersion.documentId', '=', documentId)
      .where('documentVersion.id', '=', versionId)
    if (start) query = query.where('documentVersion.createdAt', '>=', start)
    const row = await query.executeTakeFirst()
    if (!row) throw new DocumentNotFoundError()
    return row
  }

  /** The stored file of a revision; read under the document's lock before reusing it. */
  async function storedRevision(
    source: Kysely<CloudDatabase> | Transaction<CloudDatabase>,
    revisionId: string
  ) {
    const stored = await source
      .selectFrom('documentRevision')
      .innerJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
      .select([
        'documentRevision.storageObjectId',
        'storageObject.objectKey',
        'storageObject.byteSize',
        'storageObject.checksum',
        'storageObject.contentType'
      ])
      .where('documentRevision.id', '=', revisionId)
      .executeTakeFirst()
    if (!stored) throw new DocumentNotFoundError()
    return stored
  }

  return {
    async list(
      userId: string,
      documentId: string,
      page: { before?: string; limit?: number } = {}
    ): Promise<DocumentVersions> {
      const { document, start } = await openHistory(userId, documentId, false)
      const limit = Math.min(Math.max(page.limit ?? DEFAULT_PAGE_SIZE, 1), MAXIMUM_PAGE_SIZE)
      let query = versions().where('documentVersion.documentId', '=', documentId)
      if (start) query = query.where('documentVersion.createdAt', '>=', start)
      if (page.before) {
        const cursor = await findVersion(documentId, page.before, start)
        query = query.where((expression) =>
          expression.or([
            expression('documentVersion.createdAt', '<', cursor.createdAt),
            expression.and([
              expression('documentVersion.createdAt', '=', cursor.createdAt),
              expression('documentVersion.id', '<', cursor.id)
            ])
          ])
        )
      }
      const rows = await query
        .orderBy('documentVersion.createdAt', 'desc')
        .orderBy('documentVersion.id', 'desc')
        .limit(limit + 1)
        .execute()
      const shown = rows.slice(0, limit)
      return {
        versions: shown.map((row) => versionOf(row, document.currentRevisionId)),
        nextCursor: rows.length > limit ? (shown.at(-1)?.id ?? null) : null
      }
    },

    /** Names the document as it is now, as Save to version history does. */
    async save(
      userId: string,
      documentId: string,
      input: SaveDocumentVersionInput
    ): Promise<DocumentVersion> {
      const { document } = await openHistory(userId, documentId, true)
      const revisionId = document.currentRevisionId
      if (!revisionId) throw new DocumentNotFoundError()
      const description = input.description || null
      await database
        .insertInto('documentVersion')
        .values({
          id: crypto.randomUUID(),
          documentId,
          revisionId,
          kind: 'named',
          name: input.name,
          description,
          createdBy: userId,
          restoredFromVersionId: null
        })
        .onConflict((conflict) =>
          conflict
            .column('revisionId')
            .doUpdateSet({ kind: 'named', name: input.name, description })
        )
        .execute()
      announceVersions(options.onVersionsChanged, documentId)
      const row = await versions()
        .where('documentVersion.revisionId', '=', revisionId)
        .executeTakeFirstOrThrow()
      return versionOf(row, revisionId)
    },

    /** Names a version, renames it, or with a null name deletes its info so it is a checkpoint. */
    async update(
      userId: string,
      documentId: string,
      versionId: string,
      input: UpdateDocumentVersionInput
    ): Promise<DocumentVersion> {
      const { document, start } = await openHistory(userId, documentId, true)
      await findVersion(documentId, versionId, start)
      await database
        .updateTable('documentVersion')
        .set(
          input.name
            ? { kind: 'named', name: input.name, description: input.description || null }
            : { kind: 'checkpoint', name: null, description: null }
        )
        .where('id', '=', versionId)
        .execute()
      announceVersions(options.onVersionsChanged, documentId)
      return versionOf(await findVersion(documentId, versionId, start), document.currentRevisionId)
    },

    async download(
      userId: string,
      documentId: string,
      versionId: string
    ): Promise<DocumentVersionDownload> {
      const { document, start } = await openHistory(userId, documentId, false)
      const version = await findVersion(documentId, versionId, start)
      const stored = await storedRevision(database, version.revisionId)
      const expiresAt = new Date(Date.now() + DOWNLOAD_LIFETIME_MS)
      return {
        document: {
          document: documentSummary(document),
          revisionId: version.revisionId,
          byteSize: Number(stored.byteSize),
          checksum: stored.checksum,
          contentType: stored.contentType,
          download: await objects.createDownload({ key: stored.objectKey, expiresAt }),
          images: await revisionImageDownloads(database, objects, version.revisionId, expiresAt)
        },
        version: versionOf(version, document.currentRevisionId)
      }
    },

    /**
     * Makes a version the document's current state without losing anything: the state it replaces
     * is kept as a checkpoint, the restored state becomes a new revision of the same stored file,
     * and the document's live room starts over so everyone has the restored version.
     */
    async restore(
      userId: string,
      documentId: string,
      versionId: string
    ): Promise<{ document: DocumentSummary; version: DocumentVersion }> {
      const { start } = await openHistory(userId, documentId, true)
      const version = await findVersion(documentId, versionId, start)
      const revisionId = crypto.randomUUID()
      const now = new Date()
      await database.transaction().execute(async (transaction) => {
        const locked = await transaction
          .selectFrom('document')
          .select(['currentRevisionId', 'deletedAt'])
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirst()
        if (!locked || locked.deletedAt) throw new DocumentNotFoundError()
        // Compaction locks the document too, so the version's file cannot go while it is reused.
        const stored = await storedRevision(transaction, version.revisionId)
        if (locked.currentRevisionId) {
          const current = await transaction
            .selectFrom('documentRevision')
            .select('createdBy')
            .where('id', '=', locked.currentRevisionId)
            .executeTakeFirstOrThrow()
          await keepRevision(transaction, {
            documentId,
            revisionId: locked.currentRevisionId,
            createdBy: current.createdBy,
            createdAt: now
          })
        }
        await transaction
          .insertInto('documentRevision')
          .values({
            id: revisionId,
            documentId,
            parentRevisionId: locked.currentRevisionId,
            storageObjectId: stored.storageObjectId,
            createdBy: userId
          })
          .execute()
        await copyRevisionImages(transaction, version.revisionId, revisionId)
        await transaction
          .updateTable('document')
          .set({
            currentRevisionId: revisionId,
            version: (expression) => expression('version', '+', 1),
            collaborationEpoch: (expression) => expression('collaborationEpoch', '+', 1)
          })
          .where('id', '=', documentId)
          .execute()
        // A moment after the state it replaces, so the history lists it first.
        await keepRevision(transaction, {
          documentId,
          revisionId,
          createdBy: userId,
          createdAt: new Date(now.getTime() + 1),
          restoredFromVersionId: versionId
        })
      })
      // The restore stands whatever the hook does; a stale ticket is still turned away by its epoch.
      try {
        options.onRestored?.(documentId)
      } catch (error) {
        console.error('[Cloud] Ending the rooms of a restored document failed:', error)
      }
      const document = await findDocument(database, userId, documentId)
      if (!document) throw new DocumentNotFoundError()
      const restored = await versions()
        .where('documentVersion.revisionId', '=', revisionId)
        .executeTakeFirstOrThrow()
      return { document, version: versionOf(restored, revisionId) }
    },

    /** Makes a new document in the same workspace from a version, sharing its stored file. */
    async duplicate(
      userId: string,
      documentId: string,
      versionId: string,
      input: DuplicateDocumentVersionInput
    ): Promise<DocumentSummary> {
      const { document, start } = await openHistory(userId, documentId, false)
      const role = await workspaceRole(database, userId, document.workspaceId)
      if (!role) throw new DocumentNotFoundError()
      if (!WRITABLE_ROLES.has(role)) throw new DocumentForbiddenError()
      const version = await findVersion(documentId, versionId, start)
      const copyId = crypto.randomUUID()
      const revisionId = crypto.randomUUID()
      await database.transaction().execute(async (transaction) => {
        // Deleted-document cleanup removes files its document alone uses; holding the source
        // until the copy refers to the file means cleanup either finishes first or sees the copy.
        const source = await transaction
          .selectFrom('document')
          .select(['deletedAt', 'cleanupClaimId'])
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirst()
        if (!source || source.deletedAt || source.cleanupClaimId) throw new DocumentNotFoundError()
        const stored = await storedRevision(transaction, version.revisionId)
        await insertDocument(transaction, {
          id: copyId,
          workspaceId: document.workspaceId,
          name: input.name,
          kind: document.kind,
          createdBy: userId
        })
        await transaction
          .insertInto('documentRevision')
          .values({
            id: revisionId,
            documentId: copyId,
            parentRevisionId: null,
            storageObjectId: stored.storageObjectId,
            createdBy: userId
          })
          .execute()
        await copyRevisionImages(transaction, version.revisionId, revisionId)
        await transaction
          .updateTable('document')
          .set({ currentRevisionId: revisionId, version: 1 })
          .where('id', '=', copyId)
          .execute()
        await keepRevision(transaction, {
          documentId: copyId,
          revisionId,
          createdBy: userId,
          createdAt: new Date()
        })
      })
      const copy = await findDocument(database, userId, copyId)
      if (!copy) throw new DocumentNotFoundError()
      return copy
    }
  }
}

export type DocumentVersionService = ReturnType<typeof createDocumentVersionService>

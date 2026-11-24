import {
  communityThumbnailPath,
  type CommunityDocument,
  type CommunityDownload,
  type CommunityVersion,
  type DocumentVersion
} from '#cloud/contract'
import { isBannedNow, userIdText, type CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError, type DocumentService } from '#cloud/server/documents'
import type { DocumentVersionService } from '#cloud/server/documents/versions'
import type { ObjectStore } from '#cloud/server/objects'
import type { Kysely } from 'kysely'

import { extractFigThumbnailFromReader } from '@open-pencil/fig'

const communityVersion = (version: DocumentVersion): CommunityVersion => ({
  id: version.id,
  name: version.name ?? '',
  description: version.description || null,
  createdAt: version.createdAt,
  current: version.current
})

/**
 * The deployment's community gallery: the documents of the workspace its config names, which
 * anyone may open read-only without signing in or a link. Nothing marks a document as published;
 * saving it to the workspace publishes it and moving it out takes it down. A document the
 * workspace's members could not open either — deleted, taken down by an administrator, never
 * saved, or made by a banned account — is not in the gallery.
 */
export function createCommunityService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  documents: Pick<DocumentService, 'downloadShared' | 'imageLinksShared'>,
  versions: Pick<DocumentVersionService, 'namedSharedIn' | 'downloadNamedShared'>,
  workspaceId: string | null
) {
  function published() {
    return database
      .selectFrom('document')
      .innerJoin('documentRevision', 'documentRevision.id', 'document.currentRevisionId')
      .innerJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
      .select([
        'document.id',
        'document.name',
        'document.description',
        'document.kind',
        'document.updatedAt',
        'document.currentRevisionId as revisionId',
        'storageObject.objectKey',
        'storageObject.byteSize'
      ])
      .where('document.workspaceId', '=', workspaceId ?? '')
      .where('document.deletedAt', 'is', null)
      .where('document.disabledAt', 'is', null)
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('user')
              .select('user.id')
              .whereRef(userIdText, '=', 'document.createdBy')
              .where(isBannedNow)
          )
        )
      )
  }

  /** A document of the gallery, or not found for any other, so nothing outside it shows. */
  async function find(documentId: string) {
    if (!workspaceId) throw new DocumentNotFoundError()
    const row = await published().where('document.id', '=', documentId).executeTakeFirst()
    if (!row?.revisionId) throw new DocumentNotFoundError()
    return { ...row, revisionId: row.revisionId }
  }

  return {
    /** Whether the deployment has a gallery at all. */
    enabled: workspaceId !== null,

    /** The gallery's documents, most recently changed first, each with its named versions. */
    async list(): Promise<CommunityDocument[]> {
      if (!workspaceId) return []
      const rows = (await published().orderBy('document.updatedAt', 'desc').execute()).flatMap(
        ({ revisionId, ...row }) => (revisionId ? [{ ...row, revisionId }] : [])
      )
      const named = await versions.namedSharedIn(
        workspaceId,
        rows.map((row) => ({ id: row.id, currentRevisionId: row.revisionId }))
      )
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        kind: row.kind,
        updatedAt: new Date(row.updatedAt).toISOString(),
        revisionId: row.revisionId,
        thumbnailPath: communityThumbnailPath(row.id, row.revisionId),
        versions: (named.get(row.id) ?? []).map(communityVersion)
      }))
    },

    /** A gallery document as it is now, or one of its named versions, with where to download it. */
    async download(documentId: string, versionId?: string): Promise<CommunityDownload> {
      await find(documentId)
      if (!versionId) return { document: await documents.downloadShared(documentId), version: null }
      const named = await versions.downloadNamedShared(documentId, versionId)
      return { document: named.document, version: communityVersion(named.version) }
    },

    /** Links for the images a gallery document's live room names. */
    async imageLinks(documentId: string, checksums: string[]) {
      await find(documentId)
      return documents.imageLinksShared(documentId, checksums)
    },

    /**
     * A stored part of a gallery document, as it is now or in one of its named versions: its
     * file, or one of its images, by checksum. Null for a checksum that revision does not hold,
     * so nothing else in storage can be read through the gallery.
     */
    async object(documentId: string, checksum: string, versionId?: string) {
      const row = await find(documentId)
      const revisionId = versionId
        ? (await versions.downloadNamedShared(documentId, versionId)).document.revisionId
        : row.revisionId
      const file = await database
        .selectFrom('documentRevision')
        .innerJoin('storageObject', 'storageObject.id', 'documentRevision.storageObjectId')
        .select('storageObject.objectKey')
        .where('documentRevision.id', '=', revisionId)
        .where('documentRevision.documentId', '=', documentId)
        .where('storageObject.checksum', '=', checksum)
        .executeTakeFirst()
      const image = file
        ? null
        : await database
            .selectFrom('revisionImage')
            .innerJoin('workspaceImage', (join) =>
              join
                .onRef('workspaceImage.workspaceId', '=', 'revisionImage.workspaceId')
                .onRef('workspaceImage.checksum', '=', 'revisionImage.checksum')
            )
            .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
            .select('storageObject.objectKey')
            .where('revisionImage.revisionId', '=', revisionId)
            .where('revisionImage.checksum', '=', checksum)
            .executeTakeFirst()
      const key = file?.objectKey ?? image?.objectKey
      return key ? objects.read(key) : null
    },

    /**
     * The thumbnail a gallery document's stored file carries, read from storage in ranges, for
     * the revision it is now; null when that revision is not current any more or has none.
     */
    async thumbnail(documentId: string, revisionId: string): Promise<Uint8Array | null> {
      const row = await find(documentId)
      if (row.revisionId !== revisionId) return null
      return extractFigThumbnailFromReader({
        size: Number(row.byteSize),
        read: async (start, endExclusive) => {
          const bytes = await objects.readRange(row.objectKey, start, endExclusive)
          if (!bytes) throw new DocumentNotFoundError()
          return bytes
        }
      })
    }
  }
}

export type CommunityService = ReturnType<typeof createCommunityService>

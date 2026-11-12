import {
  communityThumbnailPath,
  type CommunityDocument,
  type CommunityDownload,
  type CommunityVersion,
  type DocumentVersion
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError, type DocumentService } from '#cloud/server/documents'
import type { DocumentVersionService } from '#cloud/server/documents/versions'
import type { ObjectStore } from '#cloud/server/objects'
import type { Kysely } from 'kysely'

import { extractFigThumbnailFromReader } from '@open-pencil/fig'

const communityVersion = (version: DocumentVersion): CommunityVersion => ({
  id: version.id,
  name: version.name ?? '',
  description: version.description || null,
  createdAt: version.createdAt
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
  versions: Pick<DocumentVersionService, 'namedShared' | 'downloadNamedShared'>,
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
              .whereRef(
                (expression) => expression.cast(expression.ref('user.id'), 'text'),
                '=',
                'document.createdBy'
              )
              .where('user.banned', '=', true)
              .where((user) =>
                user.or([
                  user('user.banExpires', 'is', null),
                  user('user.banExpires', '>', new Date())
                ])
              )
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
      const rows = await published().orderBy('document.updatedAt', 'desc').execute()
      return Promise.all(
        rows.flatMap((row) => {
          const { revisionId } = row
          if (!revisionId) return []
          return [
            versions.namedShared(row.id).then((named) => ({
              id: row.id,
              name: row.name,
              kind: row.kind,
              updatedAt: new Date(row.updatedAt).toISOString(),
              revisionId,
              thumbnailPath: communityThumbnailPath(row.id, revisionId),
              versions: named.map(communityVersion)
            }))
          ]
        })
      )
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

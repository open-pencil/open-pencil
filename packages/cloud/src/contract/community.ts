import * as v from 'valibot'

import { documentDownloadSchema, documentKindSchema } from './documents'

/**
 * Where a community document's thumbnail is served, by its document and revision: the address
 * changes with each save, so a copy stays good for as long as it is cached.
 */
export const COMMUNITY_THUMBNAIL_PATH = '/api/community/thumbnails'

export function communityThumbnailPath(documentId: string, revisionId: string): string {
  return `${COMMUNITY_THUMBNAIL_PATH}/${documentId}/${revisionId}`
}

/** A version of a community document someone named, such as the release it was published for. */
export const communityVersionSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  description: v.nullable(v.string()),
  createdAt: v.string()
})
export type CommunityVersion = v.InferOutput<typeof communityVersionSchema>

/**
 * A document in the deployment's community workspace, which anyone may open read-only: its name,
 * when it last changed, its thumbnail's path on the server, and its named versions, newest first.
 */
export const communityDocumentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  kind: documentKindSchema,
  updatedAt: v.string(),
  revisionId: v.pipe(v.string(), v.uuid()),
  thumbnailPath: v.string(),
  versions: v.array(communityVersionSchema)
})
export type CommunityDocument = v.InferOutput<typeof communityDocumentSchema>

/** The community workspace's documents, most recently changed first. */
export const communityDocumentsSchema = v.object({ documents: v.array(communityDocumentSchema) })
export type CommunityDocuments = v.InferOutput<typeof communityDocumentsSchema>

/** Which state of a community document to open: a named version, or else the latest. */
export const communityDownloadQuerySchema = v.object({
  version: v.optional(v.pipe(v.string(), v.uuid()))
})
export type CommunityDownloadQuery = v.InferOutput<typeof communityDownloadQuerySchema>

export function parseCommunityDownloadQuery(input: unknown): CommunityDownloadQuery {
  return v.parse(communityDownloadQuerySchema, input)
}

/** A community document, or one of its named versions, with where to download it. */
export const communityDownloadSchema = v.object({
  document: documentDownloadSchema,
  version: v.nullable(communityVersionSchema)
})
export type CommunityDownload = v.InferOutput<typeof communityDownloadSchema>

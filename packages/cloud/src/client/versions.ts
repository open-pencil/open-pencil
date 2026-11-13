import {
  documentVersionDownloadSchema,
  documentVersionResponseSchema,
  documentVersionsSchema,
  restoredDocumentSchema,
  type DocumentSummary,
  type DocumentVersion,
  type DocumentVersionDownload,
  type DocumentVersions,
  type DuplicateDocumentVersionInput,
  type SaveDocumentVersionInput,
  type UpdateDocumentVersionInput
} from '#cloud/contract'
import type { CloudAPI } from '#cloud/server/api'
import { pickBy } from 'es-toolkit/object'
import type { hc } from 'hono/client'

import { parseResponse, type CloudClientDiagnostic } from './response'
import { documentResponseSchema } from './schema'

/** A document’s version history: listing, naming, opening, restoring, and duplicating. */
export function createVersionRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    /** A page of the document's version history, newest first. */
    async listDocumentVersions(
      documentId: string,
      page: { before?: string; limit?: number } = {}
    ): Promise<DocumentVersions> {
      return parseResponse(
        client.documents[':documentId'].versions.$get({
          param: { documentId },
          query: pickBy(page, (value) => value !== undefined)
        }),
        documentVersionsSchema,
        onDiagnostic
      )
    },
    async saveDocumentVersion(
      documentId: string,
      input: SaveDocumentVersionInput
    ): Promise<DocumentVersion> {
      const response = await parseResponse(
        client.documents[':documentId'].versions.$post({ param: { documentId }, json: input }),
        documentVersionResponseSchema,
        onDiagnostic
      )
      return response.version
    },
    async updateDocumentVersion(
      documentId: string,
      versionId: string,
      input: UpdateDocumentVersionInput
    ): Promise<DocumentVersion> {
      const response = await parseResponse(
        client.documents[':documentId'].versions[':versionId'].$patch({
          param: { documentId, versionId },
          json: input
        }),
        documentVersionResponseSchema,
        onDiagnostic
      )
      return response.version
    },
    async getDocumentVersion(
      documentId: string,
      versionId: string
    ): Promise<DocumentVersionDownload> {
      return parseResponse(
        client.documents[':documentId'].versions[':versionId'].$get({
          param: { documentId, versionId }
        }),
        documentVersionDownloadSchema,
        onDiagnostic
      )
    },
    async restoreDocumentVersion(documentId: string, versionId: string) {
      return parseResponse(
        client.documents[':documentId'].versions[':versionId'].restore.$post({
          param: { documentId, versionId }
        }),
        restoredDocumentSchema,
        onDiagnostic
      )
    },
    async duplicateDocumentVersion(
      documentId: string,
      versionId: string,
      input: DuplicateDocumentVersionInput
    ): Promise<DocumentSummary> {
      const response = await parseResponse(
        client.documents[':documentId'].versions[':versionId'].duplicate.$post({
          param: { documentId, versionId },
          json: input
        }),
        documentResponseSchema,
        onDiagnostic
      )
      return response.document
    }
  }
}

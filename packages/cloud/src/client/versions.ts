import type {
  DocumentSummary,
  DocumentVersion,
  DocumentVersionDownload,
  DocumentVersions,
  DuplicateDocumentVersionInput,
  SaveDocumentVersionInput,
  UpdateDocumentVersionInput
} from '#cloud/contract'
import { pickBy } from 'es-toolkit/object'

import type { CloudContractClient } from './contract'

/** A document’s version history: listing, naming, opening, restoring, and duplicating. */
export function createVersionRequests(contract: CloudContractClient['versions']) {
  return {
    /** A page of the document's version history, newest first. */
    async listDocumentVersions(
      documentId: string,
      page: { before?: string; limit?: number } = {}
    ): Promise<DocumentVersions> {
      return contract.list({
        params: { documentId },
        query: pickBy(
          {
            before: page.before,
            limit: page.limit === undefined ? undefined : String(page.limit)
          },
          (value) => value !== undefined
        )
      })
    },
    async saveDocumentVersion(
      documentId: string,
      input: SaveDocumentVersionInput
    ): Promise<DocumentVersion> {
      return (await contract.save({ params: { documentId }, body: input })).version
    },
    async updateDocumentVersion(
      documentId: string,
      versionId: string,
      input: UpdateDocumentVersionInput
    ): Promise<DocumentVersion> {
      return (await contract.update({ params: { documentId, versionId }, body: input })).version
    },
    async getDocumentVersion(
      documentId: string,
      versionId: string
    ): Promise<DocumentVersionDownload> {
      return contract.download({ params: { documentId, versionId } })
    },
    async restoreDocumentVersion(documentId: string, versionId: string) {
      return contract.restore({ params: { documentId, versionId } })
    },
    async duplicateDocumentVersion(
      documentId: string,
      versionId: string,
      input: DuplicateDocumentVersionInput
    ): Promise<DocumentSummary> {
      return (await contract.duplicate({ params: { documentId, versionId }, body: input })).document
    }
  }
}

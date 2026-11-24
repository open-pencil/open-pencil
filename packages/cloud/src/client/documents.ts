import type {
  CloudUserProfile,
  CollaborationTicket,
  CommitUploadRequest,
  CreateDocumentRequest,
  CreateUploadInput,
  DocumentAccess,
  DocumentDownload,
  DocumentSummary,
  SharedDocument,
  TrashedDocument
} from '#cloud/contract'

import type { CloudContractClient } from './contract'

export type CloudUpload = Awaited<ReturnType<CloudContractClient['documents']['createUpload']>>

/** Documents: listing and creating them, Trash, downloads, uploads, and collaboration tickets. */
export function createDocumentRequests(
  contract: CloudContractClient['documents'],
  sharing: CloudContractClient['sharing']
) {
  return {
    async getUserProfile(documentId: string, userId: string): Promise<CloudUserProfile | null> {
      return (await sharing.userProfile({ params: { documentId, userId } })).user
    },
    /** Documents shared with the person directly, outside their workspaces. */
    async listSharedDocuments(): Promise<SharedDocument[]> {
      return (await contract.listShared()).documents
    },
    async listDocuments(workspaceId: string): Promise<DocumentSummary[]> {
      return (await contract.list({ params: { workspaceId } })).documents
    },
    async createDocument(
      workspaceId: string,
      input: CreateDocumentRequest
    ): Promise<DocumentSummary> {
      return (await contract.create({ params: { workspaceId }, body: input })).document
    },
    /** Documents in Trash the person may restore, across their workspaces, newest first. */
    async listTrash(): Promise<TrashedDocument[]> {
      return (await contract.listTrash()).documents
    },
    async restoreDocument(documentId: string): Promise<void> {
      await contract.restore({ params: { documentId } })
    },
    /** Deletes a document in Trash for good. */
    async purgeDocument(documentId: string): Promise<void> {
      await contract.purge({ params: { documentId } })
    },
    async deleteDocument(documentId: string): Promise<void> {
      await contract.remove({ params: { documentId } })
    },
    async getDocument(documentId: string): Promise<DocumentDownload> {
      return (await contract.download({ params: { documentId } })).document
    },
    async getDocumentAccess(documentId: string): Promise<DocumentAccess> {
      return (await contract.access({ params: { documentId } })).access
    },
    async getCollaborationTicket(documentId: string): Promise<CollaborationTicket> {
      return (await sharing.collaborationTicket({ params: { documentId } })).ticket
    },
    async createUpload(documentId: string, input: CreateUploadInput): Promise<CloudUpload> {
      return contract.createUpload({ params: { documentId }, body: input })
    },
    async commitUpload(uploadId: string, input: CommitUploadRequest): Promise<DocumentSummary> {
      return (await contract.commitUpload({ params: { uploadId }, body: input })).document
    }
  }
}

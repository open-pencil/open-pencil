import {
  cloudUserProfileSchema,
  type CloudUserProfile,
  type CollaborationTicket,
  type CommitUploadRequest,
  type CreateDocumentRequest,
  type CreateUploadInput,
  type DocumentAccess,
  type DocumentDownload,
  type DocumentSummary,
  type SharedDocument,
  type TrashedDocument
} from '#cloud/contract'
import type { CloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'
import * as v from 'valibot'

import type { CloudContractClient } from './contract'
import { parseResponse, type CloudClientDiagnostic } from './response'
import { collaborationTicketResponseSchema } from './schema'

const userLookupResponseSchema = v.object({ user: v.nullable(cloudUserProfileSchema) })
export type CloudUpload = Awaited<ReturnType<CloudContractClient['documents']['createUpload']>>

/** Documents: listing and creating them, Trash, downloads, uploads, and collaboration tickets. */
export function createDocumentRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
  contract: CloudContractClient['documents'],
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    async getUserProfile(documentId: string, userId: string): Promise<CloudUserProfile | null> {
      const response = await parseResponse(
        client.documents[':documentId'].users[':userId'].$get({
          param: { documentId, userId }
        }),
        userLookupResponseSchema,
        onDiagnostic
      )
      return response.user
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
      const response = await parseResponse(
        client.documents[':documentId']['collaboration-ticket'].$post({
          param: { documentId }
        }),
        collaborationTicketResponseSchema,
        onDiagnostic
      )
      return response.ticket
    },
    async createUpload(documentId: string, input: CreateUploadInput): Promise<CloudUpload> {
      return contract.createUpload({ params: { documentId }, body: input })
    },
    async commitUpload(uploadId: string, input: CommitUploadRequest): Promise<DocumentSummary> {
      return (await contract.commitUpload({ params: { uploadId }, body: input })).document
    }
  }
}

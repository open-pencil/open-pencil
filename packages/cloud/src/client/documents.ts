import {
  cloudUserProfileSchema,
  documentAccessSchema,
  documentDownloadSchema,
  objectUploadSchema,
  documentSummarySchema,
  sharedDocumentSchema,
  trashSchema,
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

import { parseResponse, responseBody, type CloudClientDiagnostic } from './response'
import { collaborationTicketResponseSchema, documentResponseSchema } from './schema'

const documentsResponseSchema = v.object({ documents: v.array(documentSummarySchema) })
const sharedDocumentsResponseSchema = v.object({ documents: v.array(sharedDocumentSchema) })
const downloadResponseSchema = v.object({ document: documentDownloadSchema })
const accessResponseSchema = v.object({ access: documentAccessSchema })
const userLookupResponseSchema = v.object({ user: v.nullable(cloudUserProfileSchema) })
const uploadResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  upload: objectUploadSchema
})

export type CloudUpload = v.InferOutput<typeof uploadResponseSchema>

/** Documents: listing and creating them, Trash, downloads, uploads, and collaboration tickets. */
export function createDocumentRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
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
      const response = await parseResponse(
        client['shared-documents'].$get(),
        sharedDocumentsResponseSchema,
        onDiagnostic
      )
      return response.documents
    },
    async listDocuments(workspaceId: string): Promise<DocumentSummary[]> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].documents.$get({
          param: { workspaceId }
        }),
        documentsResponseSchema,
        onDiagnostic
      )
      return response.documents
    },
    async createDocument(
      workspaceId: string,
      input: CreateDocumentRequest
    ): Promise<DocumentSummary> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].documents.$post({
          param: { workspaceId },
          json: { ...input, kind: input.kind ?? 'design' }
        }),
        documentResponseSchema,
        onDiagnostic
      )
      return response.document
    },
    /** Documents in Trash the person may restore, across their workspaces, newest first. */
    async listTrash(): Promise<TrashedDocument[]> {
      const response = await parseResponse(client.trash.$get(), trashSchema, onDiagnostic)
      return response.documents
    },
    async restoreDocument(documentId: string): Promise<void> {
      await responseBody(
        await client.trash[':documentId'].restore.$post({ param: { documentId } }),
        onDiagnostic
      )
    },
    /** Deletes a document in Trash for good. */
    async purgeDocument(documentId: string): Promise<void> {
      await responseBody(
        await client.trash[':documentId'].$delete({ param: { documentId } }),
        onDiagnostic
      )
    },
    async deleteDocument(documentId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].$delete({ param: { documentId } }),
        onDiagnostic
      )
    },
    async getDocument(documentId: string): Promise<DocumentDownload> {
      const response = await parseResponse(
        client.documents[':documentId'].$get({ param: { documentId } }),
        downloadResponseSchema,
        onDiagnostic
      )
      return response.document
    },
    async getDocumentAccess(documentId: string): Promise<DocumentAccess> {
      const response = await parseResponse(
        client.documents[':documentId'].access.$get({ param: { documentId } }),
        accessResponseSchema,
        onDiagnostic
      )
      return response.access
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
      return parseResponse(
        client.documents[':documentId'].uploads.$post({
          param: { documentId },
          json: input
        }),
        uploadResponseSchema,
        onDiagnostic
      )
    },
    async commitUpload(uploadId: string, input: CommitUploadRequest): Promise<DocumentSummary> {
      const response = await parseResponse(
        client.uploads[':uploadId'].commit.$post({
          param: { uploadId },
          json: { ...input, images: input.images ?? [] }
        }),
        documentResponseSchema,
        onDiagnostic
      )
      return response.document
    }
  }
}

import type { CloudFetch } from '#cloud/client/discovery'
import {
  cloudSessionSchema,
  cloudUserProfileSchema,
  collaborationTicketSchema,
  createInvitationContinuationSchema,
  documentAccessSchema,
  documentDownloadSchema,
  documentGrantSchema,
  documentInvitationSchema,
  documentShareSchema,
  documentSummarySchema,
  invitationContinuationSchema,
  invitationPreviewSchema,
  resolvedDocumentShareSchema,
  workspaceEntitlementsSchema,
  workspaceListSchema,
  workspaceUsageSchema,
  type AcceptDocumentInvitationInput,
  type CloudSession,
  type CloudUserProfile,
  type CollaborationTicket,
  type CreateInvitationContinuationInput,
  type InvitationContinuation,
  type CommitUploadInput,
  type CreateDocumentInput,
  type CreateDocumentInvitationInput,
  type CreateDocumentShareInput,
  type CreateUploadInput,
  type DocumentAccess,
  type DocumentDownload,
  type DocumentGrant,
  type DocumentInvitation,
  type DocumentShare,
  type DocumentSummary,
  type InvitationPreview,
  type LookupCloudUserInput,
  type PutDocumentGrantInput,
  type ResolveDocumentShareInput,
  type UpdateDocumentShareInput,
  type WorkspaceEntitlements,
  type WorkspaceList,
  type WorkspaceUsage
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import { hc } from 'hono/client'
import * as v from 'valibot'

const documentsResponseSchema = v.object({ documents: v.array(documentSummarySchema) })
const documentResponseSchema = v.object({ document: documentSummarySchema })
const downloadResponseSchema = v.object({ document: documentDownloadSchema })
const usageResponseSchema = v.object({ usage: workspaceUsageSchema })
const accessResponseSchema = v.object({ access: documentAccessSchema })
const sharesResponseSchema = v.object({ shares: v.array(documentShareSchema) })
const shareResponseSchema = v.object({ share: documentShareSchema })
const shareCapabilityResponseSchema = v.object({
  share: documentShareSchema,
  secret: v.string(),
  path: v.string()
})
const grantsResponseSchema = v.object({ grants: v.array(documentGrantSchema) })
const grantResponseSchema = v.object({ grant: documentGrantSchema })
const invitationPreviewResponseSchema = v.object({ invitation: invitationPreviewSchema })
const invitationsResponseSchema = v.object({ invitations: v.array(documentInvitationSchema) })
const invitationCapabilityResponseSchema = v.object({
  invitation: documentInvitationSchema,
  token: v.string()
})
const collaborationTicketResponseSchema = v.object({ ticket: collaborationTicketSchema })
const resolvedShareResponseSchema = v.object({ resolution: resolvedDocumentShareSchema })
const sharedDocumentResponseSchema = v.object({
  resolution: resolvedDocumentShareSchema,
  document: documentDownloadSchema
})
const userLookupResponseSchema = v.object({ user: v.nullable(cloudUserProfileSchema) })
const entitlementResponseSchema = v.object({ entitlements: workspaceEntitlementsSchema })
const uploadResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  upload: v.variant('kind', [
    v.object({
      kind: v.literal('single'),
      url: v.pipe(v.string(), v.url()),
      method: v.literal('PUT'),
      headers: v.record(v.string(), v.string()),
      expiresAt: v.string()
    }),
    v.object({
      kind: v.literal('multipart'),
      uploadId: v.string(),
      partSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
      parts: v.array(
        v.object({
          partNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
          url: v.pipe(v.string(), v.url()),
          method: v.literal('PUT'),
          headers: v.record(v.string(), v.string())
        })
      ),
      expiresAt: v.string()
    })
  ])
})

export type CloudErrorResponse = {
  error?: {
    code?: unknown
  }
}

export type CloudClientDiagnostic = (message: string, error: unknown) => void

export type CloudRequestOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
  accessToken?: string
  onDiagnostic?: CloudClientDiagnostic
}

export type CloudUpload = v.InferOutput<typeof uploadResponseSchema>

export class CloudAPIError extends Error {
  override readonly name = 'CloudAPIError'

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
  }
}

function apiURL(baseURL: string): string {
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CloudAPIError('OpenPencil Cloud API URL must use HTTP or HTTPS', 0)
  }
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.href
}

async function responseBody(
  response: Response,
  onDiagnostic?: CloudClientDiagnostic
): Promise<unknown> {
  if (response.ok) return response.status === 204 ? null : response.json()
  let code: string | undefined
  try {
    const body = (await response.json()) as CloudErrorResponse
    if (typeof body.error?.code === 'string') code = body.error.code
  } catch (error) {
    onDiagnostic?.('Cloud API error response was not JSON', error)
  }
  throw new CloudAPIError(
    `OpenPencil Cloud request failed with HTTP ${response.status}`,
    response.status,
    code
  )
}

async function parseResponse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  request: Promise<Response>,
  schema: TSchema,
  onDiagnostic?: CloudClientDiagnostic
): Promise<v.InferOutput<TSchema>> {
  return v.parse(schema, await responseBody(await request, onDiagnostic))
}

export function createCloudAPIClient(baseURL: string, options: CloudRequestOptions = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
  }
  const client = hc<CloudAPI>(apiURL(baseURL), {
    fetch: options.fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })
  const publicClient = hc<PublicCloudAPI>(apiURL(baseURL), {
    fetch: options.fetch,
    init: { credentials: 'include', signal: options.signal, headers }
  })

  return {
    async getSession(): Promise<CloudSession | null> {
      const response = await client.session.$get()
      if (response.status === 401) return null
      return v.parse(cloudSessionSchema, await responseBody(response, options.onDiagnostic))
    },
    async lookupUser(
      documentId: string,
      input: LookupCloudUserInput
    ): Promise<CloudUserProfile | null> {
      const response = await parseResponse(
        client.documents[':documentId'].users.lookup.$post({
          param: { documentId },
          json: input
        }),
        userLookupResponseSchema,
        options.onDiagnostic
      )
      return response.user
    },
    async getUserProfile(documentId: string, userId: string): Promise<CloudUserProfile | null> {
      const response = await parseResponse(
        client.documents[':documentId'].users[':userId'].$get({
          param: { documentId, userId }
        }),
        userLookupResponseSchema,
        options.onDiagnostic
      )
      return response.user
    },
    async listWorkspaces(): Promise<WorkspaceList> {
      return parseResponse(client.workspaces.$get(), workspaceListSchema, options.onDiagnostic)
    },
    async getWorkspaceEntitlements(workspaceId: string): Promise<WorkspaceEntitlements> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].entitlements.$get({ param: { workspaceId } }),
        entitlementResponseSchema,
        options.onDiagnostic
      )
      return response.entitlements
    },
    async getUsage(workspaceId: string): Promise<WorkspaceUsage> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].usage.$get({
          param: { workspaceId }
        }),
        usageResponseSchema,
        options.onDiagnostic
      )
      return response.usage
    },
    async listDocuments(workspaceId: string): Promise<DocumentSummary[]> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].documents.$get({
          param: { workspaceId }
        }),
        documentsResponseSchema,
        options.onDiagnostic
      )
      return response.documents
    },
    async createDocument(
      workspaceId: string,
      input: CreateDocumentInput
    ): Promise<DocumentSummary> {
      const response = await parseResponse(
        client.workspaces[':workspaceId'].documents.$post({
          param: { workspaceId },
          json: input
        }),
        documentResponseSchema,
        options.onDiagnostic
      )
      return response.document
    },
    async deleteDocument(documentId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].$delete({ param: { documentId } }),
        options.onDiagnostic
      )
    },
    async getDocument(documentId: string): Promise<DocumentDownload> {
      const response = await parseResponse(
        client.documents[':documentId'].$get({ param: { documentId } }),
        downloadResponseSchema,
        options.onDiagnostic
      )
      return response.document
    },
    async getDocumentAccess(documentId: string): Promise<DocumentAccess> {
      const response = await parseResponse(
        client.documents[':documentId'].access.$get({ param: { documentId } }),
        accessResponseSchema,
        options.onDiagnostic
      )
      return response.access
    },
    async listDocumentShares(documentId: string): Promise<DocumentShare[]> {
      const response = await parseResponse(
        client.documents[':documentId'].shares.$get({ param: { documentId } }),
        sharesResponseSchema,
        options.onDiagnostic
      )
      return response.shares
    },
    async createDocumentShare(documentId: string, input: CreateDocumentShareInput) {
      return parseResponse(
        client.documents[':documentId'].shares.$post({
          param: { documentId },
          json: input
        }),
        shareCapabilityResponseSchema,
        options.onDiagnostic
      )
    },
    async updateDocumentShare(
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      const response = await parseResponse(
        client.documents[':documentId'].shares[':shareId'].$patch({
          param: { documentId, shareId },
          json: input
        }),
        shareResponseSchema,
        options.onDiagnostic
      )
      return response.share
    },
    async rotateDocumentShare(documentId: string, shareId: string) {
      return parseResponse(
        client.documents[':documentId'].shares[':shareId'].rotate.$post({
          param: { documentId, shareId }
        }),
        shareCapabilityResponseSchema,
        options.onDiagnostic
      )
    },
    async revokeDocumentShare(documentId: string, shareId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].shares[':shareId'].$delete({
          param: { documentId, shareId }
        }),
        options.onDiagnostic
      )
    },
    async listDocumentGrants(documentId: string): Promise<DocumentGrant[]> {
      const response = await parseResponse(
        client.documents[':documentId'].grants.$get({ param: { documentId } }),
        grantsResponseSchema,
        options.onDiagnostic
      )
      return response.grants
    },
    async putDocumentGrant(
      documentId: string,
      userId: string,
      input: PutDocumentGrantInput
    ): Promise<DocumentGrant> {
      const response = await parseResponse(
        client.documents[':documentId'].grants[':userId'].$put({
          param: { documentId, userId },
          json: input
        }),
        grantResponseSchema,
        options.onDiagnostic
      )
      return response.grant
    },
    async revokeDocumentGrant(documentId: string, userId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].grants[':userId'].$delete({
          param: { documentId, userId }
        }),
        options.onDiagnostic
      )
    },
    async listDocumentInvitations(documentId: string): Promise<DocumentInvitation[]> {
      const response = await parseResponse(
        client.documents[':documentId'].invitations.$get({ param: { documentId } }),
        invitationsResponseSchema,
        options.onDiagnostic
      )
      return response.invitations
    },
    async createDocumentInvitation(documentId: string, input: CreateDocumentInvitationInput) {
      return parseResponse(
        client.documents[':documentId'].invitations.$post({
          param: { documentId },
          json: input
        }),
        invitationCapabilityResponseSchema,
        options.onDiagnostic
      )
    },
    async createInvitationContinuation(
      input: CreateInvitationContinuationInput
    ): Promise<InvitationContinuation> {
      return parseResponse(
        publicClient.invitations.continuations.$post({ json: input }),
        invitationContinuationSchema,
        options.onDiagnostic
      )
    },
    async consumeInvitationContinuation(id: string): Promise<CreateInvitationContinuationInput> {
      return parseResponse(
        publicClient.invitations.continuations[':continuationId'].consume.$post({
          param: { continuationId: id }
        }),
        createInvitationContinuationSchema,
        options.onDiagnostic
      )
    },
    async previewDocumentInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<InvitationPreview> {
      const response = await parseResponse(
        publicClient.invitations[':invitationId'].preview.$post({
          param: { invitationId },
          json: input
        }),
        invitationPreviewResponseSchema,
        options.onDiagnostic
      )
      return response.invitation
    },
    async acceptDocumentInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<DocumentGrant> {
      const response = await parseResponse(
        client.invitations[':invitationId'].accept.$post({
          param: { invitationId },
          json: input
        }),
        grantResponseSchema,
        options.onDiagnostic
      )
      return response.grant
    },
    async revokeDocumentInvitation(documentId: string, invitationId: string): Promise<void> {
      await responseBody(
        await client.documents[':documentId'].invitations[':invitationId'].$delete({
          param: { documentId, invitationId }
        }),
        options.onDiagnostic
      )
    },
    async resolveDocumentShare(shareId: string, input: ResolveDocumentShareInput) {
      const response = await parseResponse(
        publicClient.shares[':shareId'].resolve.$post({
          param: { shareId },
          json: input
        }),
        resolvedShareResponseSchema,
        options.onDiagnostic
      )
      return response.resolution
    },
    async getSharedDocument(shareId: string, input: ResolveDocumentShareInput) {
      return parseResponse(
        publicClient.shares[':shareId'].document.$post({
          param: { shareId },
          json: input
        }),
        sharedDocumentResponseSchema,
        options.onDiagnostic
      )
    },
    async getSharedCollaborationTicket(
      shareId: string,
      input: ResolveDocumentShareInput
    ): Promise<CollaborationTicket> {
      const response = await parseResponse(
        publicClient.shares[':shareId']['collaboration-ticket'].$post({
          param: { shareId },
          json: input
        }),
        collaborationTicketResponseSchema,
        options.onDiagnostic
      )
      return response.ticket
    },
    async getCollaborationTicket(documentId: string): Promise<CollaborationTicket> {
      const response = await parseResponse(
        client.documents[':documentId']['collaboration-ticket'].$post({
          param: { documentId }
        }),
        collaborationTicketResponseSchema,
        options.onDiagnostic
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
        options.onDiagnostic
      )
    },
    async commitUpload(uploadId: string, input: CommitUploadInput): Promise<DocumentSummary> {
      const response = await parseResponse(
        client.uploads[':uploadId'].commit.$post({
          param: { uploadId },
          json: input
        }),
        documentResponseSchema,
        options.onDiagnostic
      )
      return response.document
    }
  }
}

export type CloudAPIClient = ReturnType<typeof createCloudAPIClient>

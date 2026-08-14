import type { CloudFetch } from '#cloud/client/discovery'
import {
  cloudSessionSchema,
  documentDownloadSchema,
  documentSummarySchema,
  workspaceListSchema,
  workspaceUsageSchema,
  type CloudSession,
  type CommitUploadInput,
  type CreateDocumentInput,
  type CreateUploadInput,
  type DocumentDownload,
  type DocumentSummary,
  type WorkspaceList,
  type WorkspaceUsage
} from '#cloud/contract'
import type { CloudAPI } from '#cloud/server/api'
import { hc } from 'hono/client'
import * as v from 'valibot'

const documentsResponseSchema = v.object({ documents: v.array(documentSummarySchema) })
const documentResponseSchema = v.object({ document: documentSummarySchema })
const downloadResponseSchema = v.object({ document: documentDownloadSchema })
const usageResponseSchema = v.object({ usage: workspaceUsageSchema })
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

export type CloudRequestOptions = {
  fetch?: CloudFetch
  signal?: AbortSignal
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

async function responseBody(response: Response): Promise<unknown> {
  if (response.ok) return response.status === 204 ? null : response.json()
  let code: string | undefined
  try {
    const body = (await response.json()) as CloudErrorResponse
    if (typeof body.error?.code === 'string') code = body.error.code
  } catch (error) {
    console.warn('[Cloud] API error response was not JSON:', error)
  }
  throw new CloudAPIError(
    `OpenPencil Cloud request failed with HTTP ${response.status}`,
    response.status,
    code
  )
}

export function createCloudAPIClient(baseURL: string, options: CloudRequestOptions = {}) {
  const client = hc<CloudAPI>(apiURL(baseURL), {
    fetch: options.fetch,
    init: { credentials: 'include', signal: options.signal }
  })

  return {
    async getSession(): Promise<CloudSession | null> {
      const response = await client.session.$get()
      if (response.status === 401) return null
      return v.parse(cloudSessionSchema, await responseBody(response))
    },
    async listWorkspaces(): Promise<WorkspaceList> {
      return v.parse(workspaceListSchema, await responseBody(await client.workspaces.$get()))
    },
    async getUsage(workspaceId: string): Promise<WorkspaceUsage> {
      const response = v.parse(
        usageResponseSchema,
        await responseBody(
          await client.workspaces[':workspaceId'].usage.$get({
            param: { workspaceId }
          })
        )
      )
      return response.usage
    },
    async listDocuments(workspaceId: string): Promise<DocumentSummary[]> {
      const response = v.parse(
        documentsResponseSchema,
        await responseBody(
          await client.workspaces[':workspaceId'].documents.$get({
            param: { workspaceId }
          })
        )
      )
      return response.documents
    },
    async createDocument(
      workspaceId: string,
      input: CreateDocumentInput
    ): Promise<DocumentSummary> {
      const response = v.parse(
        documentResponseSchema,
        await responseBody(
          await client.workspaces[':workspaceId'].documents.$post({
            param: { workspaceId },
            json: input
          })
        )
      )
      return response.document
    },
    async deleteDocument(documentId: string): Promise<void> {
      await responseBody(await client.documents[':documentId'].$delete({ param: { documentId } }))
    },
    async getDocument(documentId: string): Promise<DocumentDownload> {
      const response = v.parse(
        downloadResponseSchema,
        await responseBody(await client.documents[':documentId'].$get({ param: { documentId } }))
      )
      return response.document
    },
    async createUpload(documentId: string, input: CreateUploadInput): Promise<CloudUpload> {
      return v.parse(
        uploadResponseSchema,
        await responseBody(
          await client.documents[':documentId'].uploads.$post({
            param: { documentId },
            json: input
          })
        )
      )
    },
    async commitUpload(uploadId: string, input: CommitUploadInput): Promise<DocumentSummary> {
      const response = v.parse(
        documentResponseSchema,
        await responseBody(
          await client.uploads[':uploadId'].commit.$post({
            param: { uploadId },
            json: input
          })
        )
      )
      return response.document
    }
  }
}

export type CloudAPIClient = ReturnType<typeof createCloudAPIClient>

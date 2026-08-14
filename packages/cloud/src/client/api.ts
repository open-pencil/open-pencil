import type { CloudFetch } from '#cloud/client/discovery'
import {
  documentDownloadSchema,
  documentSummarySchema,
  workspaceListSchema,
  type CommitUploadInput,
  type CreateDocumentInput,
  type CreateUploadInput,
  type DocumentDownload,
  type DocumentSummary,
  type WorkspaceList
} from '#cloud/contract'
import * as v from 'valibot'

const documentsResponseSchema = v.object({ documents: v.array(documentSummarySchema) })
const documentResponseSchema = v.object({ document: documentSummarySchema })
const downloadResponseSchema = v.object({ document: documentDownloadSchema })
const uploadResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  upload: v.object({
    url: v.pipe(v.string(), v.url()),
    method: v.literal('PUT'),
    headers: v.record(v.string(), v.string()),
    expiresAt: v.string()
  })
})

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

function apiURL(baseURL: string, path: string): URL {
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CloudAPIError('OpenPencil Cloud API URL must use HTTP or HTTPS', 0)
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  url.search = ''
  url.hash = ''
  return url
}

export function createCloudClient(baseURL: string, options: CloudRequestOptions = {}) {
  const fetchImplementation = options.fetch ?? globalThis.fetch

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await fetchImplementation(apiURL(baseURL, path), {
      ...init,
      credentials: 'include',
      headers,
      signal: init.signal ?? options.signal
    })
    if (!response.ok) {
      let code: string | undefined
      try {
        const body = (await response.json()) as { error?: { code?: unknown } }
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
    return response.json()
  }

  return {
    async listWorkspaces(): Promise<WorkspaceList> {
      return v.parse(workspaceListSchema, await request('/workspaces'))
    },
    async listDocuments(workspaceId: string): Promise<DocumentSummary[]> {
      const response = v.parse(
        documentsResponseSchema,
        await request(`/workspaces/${encodeURIComponent(workspaceId)}/documents`)
      )
      return response.documents
    },
    async createDocument(
      workspaceId: string,
      input: CreateDocumentInput
    ): Promise<DocumentSummary> {
      const response = v.parse(
        documentResponseSchema,
        await request(`/workspaces/${encodeURIComponent(workspaceId)}/documents`, {
          method: 'POST',
          body: JSON.stringify(input)
        })
      )
      return response.document
    },
    async getDocument(documentId: string): Promise<DocumentDownload> {
      const response = v.parse(
        downloadResponseSchema,
        await request(`/documents/${encodeURIComponent(documentId)}`)
      )
      return response.document
    },
    async createUpload(documentId: string, input: CreateUploadInput): Promise<CloudUpload> {
      return v.parse(
        uploadResponseSchema,
        await request(`/documents/${encodeURIComponent(documentId)}/uploads`, {
          method: 'POST',
          body: JSON.stringify(input)
        })
      )
    },
    async commitUpload(uploadId: string, input: CommitUploadInput): Promise<DocumentSummary> {
      const response = v.parse(
        documentResponseSchema,
        await request(`/uploads/${encodeURIComponent(uploadId)}/commit`, {
          method: 'POST',
          body: JSON.stringify(input)
        })
      )
      return response.document
    }
  }
}

export type CloudClient = ReturnType<typeof createCloudClient>

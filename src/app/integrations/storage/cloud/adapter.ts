import type {
  StorageAdapter,
  StorageDocumentMetadata,
  StorageProviderRuntime,
  StorageTransferProgress
} from '../types'
import type { CloudConnectionService } from './connection'
import { cloudConnectionService } from './service'
import { createCloudTransport, type CloudTransport } from './transport'
import { uploadCloudObject } from './upload'

const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`OpenPencil Cloud ${field} is required`)
  return value
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const body = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', body)
  const binary = String.fromCharCode(...new Uint8Array(digest))
  return btoa(binary)
}

function reportProgress(
  onProgress: ((progress: StorageTransferProgress) => void) | undefined,
  transferredBytes: number,
  totalBytes: number
): void {
  onProgress?.({ transferredBytes, totalBytes })
}

export type CloudStorageAdapterDependencies = {
  connectionService?: CloudConnectionService
  transport?: CloudTransport
}

export function createCloudStorageAdapter(
  runtime: StorageProviderRuntime,
  dependencies: CloudStorageAdapterDependencies = {}
): StorageAdapter {
  const transport = dependencies.transport ?? createCloudTransport()
  const connectionService = dependencies.connectionService ?? cloudConnectionService
  const serverURL = requiredPreference(runtime, SERVER_URL_FIELD)
  const workspaceId = requiredPreference(runtime, WORKSPACE_ID_FIELD)

  async function client() {
    const connection = await connectionService.connect(serverURL)
    if (!connection.discovery?.capabilities.documents) {
      throw new Error('This OpenPencil Cloud server does not support document storage')
    }
    if (!connection.client) throw new Error('OpenPencil Cloud is unavailable')
    return connection.client
  }

  return {
    async testConnection() {
      try {
        const cloud = await client()
        const workspaces = await cloud.listWorkspaces()
        if (!workspaces.workspaces.some((workspace) => workspace.id === workspaceId)) {
          return { ok: false, message: 'The selected Cloud workspace is unavailable.' }
        }
        return { ok: true, message: 'Connected to OpenPencil Cloud.' }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    },

    async listDocuments() {
      return (await (await client()).listDocuments(workspaceId)).map((document) => ({
        id: document.id,
        name: document.name,
        updatedAt: document.updatedAt,
        metadataAuthoritative: true,
        remoteRevisionId: document.currentRevisionId
      }))
    },

    async getDocument(id, onProgress) {
      const download = await (await client()).getDocument(id)
      const response = await transport.objectFetch(download.download.url, {
        method: download.download.method,
        headers: download.download.headers
      })
      if (!response.ok)
        throw new Error(`Cloud document download failed with HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength !== download.byteSize)
        throw new Error('Cloud document size verification failed')
      if ((await sha256(bytes)) !== download.checksum)
        throw new Error('Cloud document checksum verification failed')
      reportProgress(onProgress, bytes.byteLength, download.byteSize)
      return bytes
    },

    async putDocument(id, bytes, metadata, onProgress, options) {
      const cloud = await client()
      const documents = await cloud.listDocuments(workspaceId)
      let document = documents.find((candidate) => candidate.id === id)
      if (!document) {
        document = await cloud.createDocument(workspaceId, { id, name: metadata.name })
      }
      const checksum = await sha256(bytes)
      const pending = await uploadCloudObject({
        cloud,
        documentId: document.id,
        bytes,
        checksum,
        baseRevisionId: options?.remoteRevisionId ?? null,
        transport,
        onProgress,
        signal: options?.signal
      })
      const committed = await cloud.commitUpload(pending.uploadId, {
        checksum,
        multipart: pending.multipart
      })
      return { remoteRevisionId: committed.currentRevisionId }
    },

    async deleteDocument(id) {
      await (await client()).deleteDocument(id)
    },

    async getDocumentMetadata(id): Promise<StorageDocumentMetadata | null> {
      const cloud = await client()
      const document = (await cloud.listDocuments(workspaceId)).find(
        (candidate) => candidate.id === id
      )
      return document ? { name: document.name, updatedAt: document.updatedAt } : null
    },

    async getUsage() {
      return (await client()).getUsage(workspaceId)
    }
  }
}

import { createCloudClient, discoverCloud } from '@open-pencil/cloud/client'

import type {
  StorageAdapter,
  StorageDocumentMetadata,
  StorageProviderRuntime,
  StorageTransferProgress
} from '../types'

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

export function createCloudStorageAdapter(runtime: StorageProviderRuntime): StorageAdapter {
  const serverURL = requiredPreference(runtime, SERVER_URL_FIELD)
  const workspaceId = requiredPreference(runtime, WORKSPACE_ID_FIELD)

  async function client() {
    const discovery = await discoverCloud(serverURL)
    if (!discovery.capabilities.documents) {
      throw new Error('This OpenPencil Cloud server does not support document storage')
    }
    return createCloudClient(discovery.apiURL)
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
        metadataAuthoritative: true
      }))
    },

    async getDocument(id, onProgress) {
      const download = await (await client()).getDocument(id)
      const response = await fetch(download.download.url, {
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

    async putDocument(id, bytes, metadata, onProgress) {
      const cloud = await client()
      const documents = await cloud.listDocuments(workspaceId)
      let document = documents.find((candidate) => candidate.id === id)
      if (!document) {
        document = await cloud.createDocument(workspaceId, { id, name: metadata.name })
      }
      const checksum = await sha256(bytes)
      const pending = await cloud.createUpload(document.id, {
        baseRevisionId: document.currentRevisionId,
        byteSize: bytes.byteLength,
        checksum,
        contentType: 'application/octet-stream'
      })
      reportProgress(onProgress, 0, bytes.byteLength)
      const response = await fetch(pending.upload.url, {
        method: pending.upload.method,
        headers: pending.upload.headers,
        body: Uint8Array.from(bytes)
      })
      if (!response.ok) throw new Error(`Cloud document upload failed with HTTP ${response.status}`)
      reportProgress(onProgress, bytes.byteLength, bytes.byteLength)
      await cloud.commitUpload(pending.id, { checksum })
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

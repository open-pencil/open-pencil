import { CloudAPIError, type CloudAPIClient } from '@open-pencil/cloud/client'
import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { cloudServerHost } from '@/app/cloud/servers/address'
import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, recheckedCloudConnection } from '@/app/cloud/sessions/connection'

import { StorageRevisionConflictError, StorageUnavailableError } from '../errors'
import { storageFetch } from '../s3/fetch'
import type { StorageAdapter, StorageProviderRuntime } from '../types'
import { cloudChecksum, downloadCloudDocument, readCloudRevisionRange } from './download'
import { splitCloudDocument, uploadCloudImages } from './images'
import { uploadCloudObject } from './upload'

function revisionConflict(error: unknown): boolean {
  return error instanceof CloudAPIError && error.code === 'revision_conflict'
}

/** The server refused the save as declared, as when an image it named was released meanwhile. */
function invalidUpload(error: unknown): boolean {
  return error instanceof CloudAPIError && error.code === 'invalid_upload'
}

export type CloudStorageDependencies = {
  /** The signed-in API client for a server, or a `StorageUnavailableError`. */
  client(serverId: string): Promise<CloudAPIClient>
  /** Object-store transfers carry no Cloud session, so desktop can send them natively. */
  objectFetch(input: string, init: RequestInit): Promise<Response>
}

/** The API client of a signed-in server, asking it once more before giving up. */
async function signedInClient(serverId: string): Promise<CloudAPIClient> {
  const server = findCloudServer(serverId)
  if (!server) throw new StorageUnavailableError('This Cloud server was removed from the app')
  const connection = await recheckedCloudConnection(server)
  if (connection.state !== 'signed-in' || !connection.discovery) {
    throw new StorageUnavailableError(`Sign in to ${cloudServerHost(server.url)} to sync`)
  }
  return cloudAPIClient(server, connection.discovery)
}

const defaults: CloudStorageDependencies = {
  client: signedInClient,
  objectFetch: (input, init) => storageFetch(input, init)
}

/**
 * Documents in one workspace of a Cloud server: the storage profile is the server and the
 * container is the workspace. Every write names the revision it was edited from, and the server
 * refuses it when someone saved since.
 */
export function createCloudStorageAdapter(
  runtime: StorageProviderRuntime,
  dependencies: CloudStorageDependencies = defaults
): StorageAdapter {
  const serverId = runtime.profileId
  const client = () => dependencies.client(serverId)

  function workspaceId(): string {
    if (!runtime.containerId) throw new Error('A Cloud storage location names its workspace')
    return runtime.containerId
  }

  async function listed(id: string) {
    const documents = await (await client()).listDocuments(workspaceId())
    return documents.find((document) => document.id === id) ?? null
  }

  return {
    async testConnection() {
      try {
        const workspaces = await (await client()).listWorkspaces()
        const found = workspaces.workspaces.some((workspace) => workspace.id === workspaceId())
        return found
          ? { ok: true, message: 'Connected to OpenPencil Cloud.' }
          : { ok: false, message: 'This workspace is no longer available.' }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    },

    async listDocuments() {
      const documents = await (await client()).listDocuments(workspaceId())
      return documents.map((document) => ({
        id: document.id,
        name: document.name,
        updatedAt: document.updatedAt,
        metadataAuthoritative: true,
        revision: document.currentRevisionId
      }))
    },

    async getDocument(id, onProgress, signal) {
      const download = await (await client()).getDocument(id)
      const bytes = await downloadCloudDocument(
        download,
        (input, init) => dependencies.objectFetch(input, init),
        { signal, onProgress }
      )
      return { bytes, revision: download.revisionId }
    },

    async putDocument(id, bytes, metadata, onProgress, options) {
      const cloud = await client()
      const baseRevision = options?.baseRevision ?? null
      // Without a revision this is the first save; the document may not exist on the server yet.
      if (!baseRevision && !(await listed(id))) {
        await cloud.createDocument(workspaceId(), { id, name: metadata.name })
      }
      // The workspace keeps images once; the stored file names them and uploads only those it lacks.
      const { lean, images } = splitCloudDocument(bytes)
      const named = await Promise.all(
        images.map(async (image) => ({ ...image, checksum: await cloudChecksum(image.bytes) }))
      )
      const checksum = await cloudChecksum(lean)
      const objectFetch = (input: string, init: RequestInit) =>
        dependencies.objectFetch(input, init)
      const save = async () => {
        await uploadCloudImages({ cloud, documentId: id, images: named, objectFetch })
        const upload = await uploadCloudObject({
          cloud,
          documentId: id,
          bytes: lean,
          checksum,
          baseRevision,
          objectFetch,
          onProgress
        })
        const committed = await cloud.commitUpload(upload.uploadId, {
          checksum,
          multipart: upload.multipart,
          images: named.map((image) => ({ name: image.name, checksum: image.checksum }))
        })
        return { revision: committed.currentRevisionId }
      }
      try {
        // An image released between asking and committing is uploaded again by a second try.
        return await save().catch((error: unknown) => {
          if (invalidUpload(error)) return save()
          throw error
        })
      } catch (error) {
        if (revisionConflict(error)) {
          throw new StorageRevisionConflictError((await listed(id))?.currentRevisionId ?? null)
        }
        throw error
      }
    },

    async getThumbnail(id) {
      const download = await (await client()).getDocument(id)
      const objectFetch = (input: string, init: RequestInit) =>
        dependencies.objectFetch(input, init)
      return extractFigThumbnailFromReader({
        size: download.byteSize,
        read: (start, endExclusive) =>
          readCloudRevisionRange(download, objectFetch, start, endExclusive)
      })
    },

    async deleteDocument(id) {
      await (await client()).deleteDocument(id)
    },

    async getDocumentMetadata(id) {
      const document = await listed(id)
      return document ? { name: document.name, updatedAt: document.updatedAt } : null
    },

    async getUsage() {
      return (await client()).getUsage(workspaceId())
    }
  }
}

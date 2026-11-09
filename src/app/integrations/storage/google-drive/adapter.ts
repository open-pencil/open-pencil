import { sumBy } from 'es-toolkit'
import * as v from 'valibot'

import { StorageRevisionConflictError, StorageUnavailableError } from '../errors'
import type {
  StorageAdapter,
  StorageDocument,
  StorageDocumentMetadata,
  StorageProviderRuntime
} from '../types'
import { driveAccessToken, forgetDriveToken } from './auth'

/**
 * Documents as `.fig` files in one folder of the person's Google Drive. Each file carries the
 * Lawha document id in its `appProperties`, so renaming it in Drive keeps the link; Drive's
 * `version` is the revision, so a save from another device is caught as a conflict.
 */
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FIG_MIME = 'application/octet-stream'
const ID_PROPERTY = 'lawhaId'
const DEFAULT_FOLDER = 'Lawha'
const FILE_FIELDS = 'id,name,modifiedTime,version,size,appProperties,thumbnailLink'

export const DRIVE_CLIENT_ID_FIELD = 'client-id'
export const DRIVE_FOLDER_FIELD = 'folder'

const driveFileSchema = v.object({
  id: v.string(),
  name: v.string(),
  modifiedTime: v.optional(v.string()),
  version: v.optional(v.string()),
  size: v.optional(v.string()),
  thumbnailLink: v.optional(v.string()),
  appProperties: v.optional(v.record(v.string(), v.string()))
})
type DriveFile = v.InferOutput<typeof driveFileSchema>

const fileListSchema = v.object({
  files: v.array(driveFileSchema),
  nextPageToken: v.optional(v.string())
})

/** Quotes a value for a Drive search query. */
const quoted = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** How the adapter gets a Google token; tests pass their own instead of signing in. */
export interface DriveAuth {
  token(clientId: string, interactive: boolean): Promise<string>
  forget(): void
}

const googleSignIn: DriveAuth = { token: driveAccessToken, forget: forgetDriveToken }

class DriveSession {
  private folderId: string | null = null

  constructor(
    private readonly runtime: StorageProviderRuntime,
    private readonly auth: DriveAuth
  ) {}

  private get clientId(): string {
    const id = this.runtime.preferences[DRIVE_CLIENT_ID_FIELD]?.trim()
    if (!id) throw new Error('Add the Google OAuth client ID in Settings → Storage')
    return id
  }

  private get folderName(): string {
    return this.runtime.preferences[DRIVE_FOLDER_FIELD]?.trim() || DEFAULT_FOLDER
  }

  /** Calls Drive; a refused token is dropped so the next connect signs in again. */
  async request(url: string, init: RequestInit = {}, interactive = false): Promise<Response> {
    const token = await this.auth.token(this.clientId, interactive)
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(url, { ...init, headers })
    if (response.status === 401) {
      this.auth.forget()
      throw new StorageUnavailableError('Google Drive sign-in expired; reconnect in Settings')
    }
    if (!response.ok && response.status !== 404) {
      throw new Error(`Google Drive answered ${response.status}: ${await response.text()}`)
    }
    return response
  }

  async json<T>(schema: v.GenericSchema<unknown, T>, url: string, init?: RequestInit) {
    const response = await this.request(url, init)
    const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
    if (!parsed.success) throw new Error('Google Drive sent an unexpected answer')
    return parsed.output
  }

  async folder(interactive = false): Promise<string> {
    if (this.folderId) return this.folderId
    const query = `mimeType=${quoted(FOLDER_MIME)} and name=${quoted(this.folderName)} and trashed=false`
    const params = new URLSearchParams({ q: query, fields: 'files(id,name)', spaces: 'drive' })
    if (interactive) await this.auth.token(this.clientId, true)
    const found = await this.json(fileListSchema, `${API}/files?${params}`)
    if (found.files[0]) {
      this.folderId = found.files[0].id
      return this.folderId
    }
    const created = await this.json(driveFileSchema, `${API}/files?fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.folderName, mimeType: FOLDER_MIME })
    })
    this.folderId = created.id
    return created.id
  }

  async listFiles(): Promise<DriveFile[]> {
    const folder = await this.folder()
    const files: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q: `${quoted(folder)} in parents and trashed=false`,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: '200',
        ...(pageToken ? { pageToken } : {})
      })
      const page = await this.json(fileListSchema, `${API}/files?${params}`)
      files.push(...page.files)
      pageToken = page.nextPageToken
    } while (pageToken)
    return files
  }

  async findFile(id: string): Promise<DriveFile | null> {
    const folder = await this.folder()
    const params = new URLSearchParams({
      q: `${quoted(folder)} in parents and trashed=false and appProperties has { key=${quoted(ID_PROPERTY)} and value=${quoted(id)} }`,
      fields: `files(${FILE_FIELDS})`
    })
    const page = await this.json(fileListSchema, `${API}/files?${params}`)
    return page.files[0] ?? null
  }

  /** Creates or replaces the file in one multipart upload: metadata and bytes together. */
  async upload(
    existing: DriveFile | null,
    id: string,
    bytes: Uint8Array,
    metadata: StorageDocumentMetadata
  ): Promise<DriveFile> {
    const folder = await this.folder()
    const boundary = `lawha-${crypto.randomUUID()}`
    const meta: Record<string, unknown> = {
      name: fileName(metadata.name),
      modifiedTime: metadata.updatedAt,
      appProperties: { [ID_PROPERTY]: id }
    }
    if (!existing) {
      meta.parents = [folder]
      meta.mimeType = FIG_MIME
    }
    const encoder = new TextEncoder()
    const head = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: ${FIG_MIME}\r\n\r\n`
    )
    const tail = encoder.encode(`\r\n--${boundary}--`)
    const body = new Uint8Array(head.length + bytes.length + tail.length)
    body.set(head, 0)
    body.set(bytes, head.length)
    body.set(tail, head.length + bytes.length)
    const url = existing
      ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=${FILE_FIELDS}`
      : `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`
    return this.json(driveFileSchema, url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    })
  }
}

/** A Drive file name with the `.fig` extension, so Drive and Figma both recognise it. */
function fileName(name: string): string {
  const trimmed = name.trim() || 'Untitled'
  return trimmed.toLowerCase().endsWith('.fig') ? trimmed : `${trimmed}.fig`
}

function documentName(file: DriveFile): string {
  return file.name.replace(/\.fig$/i, '')
}

function toDocument(file: DriveFile): StorageDocument | null {
  const id = file.appProperties?.[ID_PROPERTY]
  if (!id) return null
  return {
    id,
    name: documentName(file),
    updatedAt: file.modifiedTime ?? new Date(0).toISOString(),
    metadataAuthoritative: true,
    revision: file.version ?? null,
    thumbnailURL: file.thumbnailLink ?? null
  }
}

export function createGoogleDriveStorageAdapter(
  runtime: StorageProviderRuntime,
  auth: DriveAuth = googleSignIn
): StorageAdapter {
  const drive = new DriveSession(runtime, auth)
  return {
    async testConnection() {
      try {
        await drive.folder(true)
        return { ok: true, message: 'Connected to Google Drive.' }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    },

    async listDocuments() {
      const files = await drive.listFiles()
      return files
        .map(toDocument)
        .filter((doc): doc is StorageDocument => doc !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async getDocument(id, onProgress, signal) {
      signal?.throwIfAborted()
      const file = await drive.findFile(id)
      if (!file) throw new Error(`Document ${id} is not in Google Drive`)
      const response = await drive.request(`${API}/files/${file.id}?alt=media`, { signal })
      const bytes = new Uint8Array(await response.arrayBuffer())
      onProgress?.({ transferredBytes: bytes.length, totalBytes: bytes.length })
      return { bytes, revision: file.version ?? null }
    },

    async putDocument(id, bytes, metadata, onProgress, options) {
      const existing = await drive.findFile(id)
      const base = options?.baseRevision
      if (existing && base && existing.version && existing.version !== base) {
        throw new StorageRevisionConflictError(existing.version)
      }
      const saved = await drive.upload(existing, id, bytes, metadata)
      onProgress?.({ transferredBytes: bytes.length, totalBytes: bytes.length })
      return { revision: saved.version ?? null }
    },

    async deleteDocument(id) {
      const file = await drive.findFile(id)
      if (!file) return
      await drive.request(`${API}/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true })
      })
    },

    async getDocumentMetadata(id) {
      const file = await drive.findFile(id)
      if (!file) return null
      return { name: documentName(file), updatedAt: file.modifiedTime ?? new Date(0).toISOString() }
    },

    async getUsage() {
      const files = await drive.listFiles()
      const documents = files.filter((file) => file.appProperties?.[ID_PROPERTY])
      return {
        bytesUsed: sumBy(files, (file) => Number(file.size ?? 0)),
        objectCount: files.length,
        documentCount: documents.length
      }
    }
  }
}

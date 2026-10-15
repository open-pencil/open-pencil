import { StorageConflictError } from '../conflict'
import { bodyKey, documentHeadKey, versionManifestKey } from '../namespace'
import {
  S3HttpError,
  getObject,
  getObjectValue,
  headObject,
  putObject,
  type DownloadProgress,
  type UploadProgress
} from '../s3/client'
import type { S3CompatibleConfig } from '../s3/types'
import type {
  CommittedVersion,
  StorageDocumentMetadata,
  VersionCommitBase,
  VersionCommitOptions
} from '../types'
import {
  nextDocumentHead,
  parseDocumentHead,
  serializeDocumentHead,
  type DocumentHead
} from './head'
import { serializeVersionManifest, VERSION_MANIFEST_SCHEMA, type VersionManifest } from './manifest'
import { readVersionManifest, rememberVersionManifest } from './manifest-cache'

export class MissingVersionIdentityError extends Error {
  constructor(id: string) {
    super(`Version commit for ${id} lacks bodyId/stateId; identity must be computed before commit`)
    this.name = 'MissingVersionIdentityError'
  }
}

type IdentifiedMetadata = StorageDocumentMetadata & { bodyId: string; stateId: string }

function identified(id: string, metadata: StorageDocumentMetadata): IdentifiedMetadata {
  const { bodyId, stateId } = metadata
  if (!bodyId || !stateId) throw new MissingVersionIdentityError(id)
  return { ...metadata, bodyId, stateId }
}

type HeadRead = { head: DocumentHead; etag: string | null }

async function readHead(config: S3CompatibleConfig, id: string): Promise<HeadRead | null> {
  const { bytes, etag } = await getObjectValue(config, documentHeadKey(id))
  const head = parseDocumentHead(bytes)
  return head ? { head, etag } : null
}

/**
 * The commit's conflict check, made on the head it has just read rather than on a separate
 * preflight: a head that moved past every state this device knows means another device wrote.
 * Nothing known (a fresh or rebased row) never conflicts on its own, and a head that already
 * holds the intended state means identical edits converged.
 */
/**
 * A metadata-only commit reuses a stored body. When the head is gone, another device deleted the
 * design and its body may be collected, so writing a head would bring back a broken copy.
 */
function assertNotDeleted(
  id: string,
  metadataOnly: boolean,
  headExists: boolean,
  expected: VersionCommitBase | undefined
): void {
  const knowsAState = expected?.baseStateId != null || expected?.lastPublishedStateId != null
  if (metadataOnly && !headExists && knowsAState) {
    throw new StorageConflictError(`"${id}" was deleted on another device.`)
  }
}

function assertHeadIsKnown(
  id: string,
  head: DocumentHead | null,
  intendedStateId: string,
  expected: VersionCommitBase | undefined
): void {
  if (!expected || !head) return
  const known = [expected.baseStateId, expected.lastPublishedStateId].filter(
    (stateId): stateId is string => stateId !== null
  )
  if (known.length === 0) return
  if (head.stateId === intendedStateId || known.includes(head.stateId)) return
  throw new StorageConflictError(`"${id}" changed on another device since this one last synced it.`)
}

/**
 * The head update. `If-Match` on the head's own ETag turns a lost race into HTTP 412 where a
 * provider enforces it; a weak validator is never sent, since If-Match must not match one.
 */
async function writeHead(
  config: S3CompatibleConfig,
  id: string,
  head: DocumentHead,
  ifMatch: string | null
): Promise<void> {
  const strongMatch = ifMatch !== null && !ifMatch.startsWith('W/') ? ifMatch : undefined
  try {
    await putObject(
      config,
      documentHeadKey(id),
      serializeDocumentHead(head),
      'application/json',
      undefined,
      strongMatch ? { ifMatch: strongMatch } : undefined
    )
  } catch (error) {
    if (error instanceof S3HttpError && error.status === 412) {
      throw new StorageConflictError(
        `"${id}" changed on another device while this commit was in flight.`
      )
    }
    throw error
  }
}

export type S3CommitOptions = VersionCommitOptions & {
  /** Send `If-Match` on the head update; only where the provider is known to enforce it. */
  conditional?: boolean
}

/**
 * The versioned commit: body, then manifest, then head, with the head last. A crash before the
 * head update leaves orphans for garbage collection but never a torn document. One head read
 * per commit serves the conflict check, the history chain, and the ETag; the body is sent
 * without a HEAD probe unless this is a retry.
 */
export async function s3CommitVersion(
  config: S3CompatibleConfig,
  id: string,
  bytes: Uint8Array | null,
  readWritten: () => Promise<StorageDocumentMetadata>,
  onUploadProgress?: (progress: UploadProgress) => void,
  options: S3CommitOptions = {}
): Promise<CommittedVersion> {
  const dispatched = identified(id, await readWritten())
  const previous = await readHead(config, id)
  assertNotDeleted(id, bytes === null, previous !== null, options.expectedBase)
  assertHeadIsKnown(id, previous?.head ?? null, dispatched.stateId, options.expectedBase)
  if (previous?.head.stateId === dispatched.stateId) {
    // The remote already holds exactly this state: nothing to write.
    return {
      stateId: dispatched.stateId,
      bodyId: dispatched.bodyId,
      parentStateId: previous.head.history[1] ?? null
    }
  }

  if (bytes !== null) {
    const key = bodyKey(dispatched.bodyId)
    // Content-addressed: a body already stored is never sent again.
    const stored = options.retry === true && (await headObject(config, key))
    if (!stored) {
      await putObject(config, key, bytes, 'application/octet-stream', onUploadProgress)
    }
  }
  const latest = bytes !== null ? identified(id, await readWritten()) : dispatched
  // The body half stays the one just stored, whatever the row did during the upload.
  const written: IdentifiedMetadata = { ...latest, bodyId: dispatched.bodyId }

  const manifest: VersionManifest = {
    schema: VERSION_MANIFEST_SCHEMA,
    bodyId: written.bodyId,
    metadata: written
  }
  await putObject(
    config,
    versionManifestKey(written.stateId),
    serializeVersionManifest(manifest),
    'application/json'
  )
  rememberVersionManifest(config, written.stateId, { manifest, authoritative: true })
  await writeHead(
    config,
    id,
    nextDocumentHead(written.stateId, previous?.head ?? null),
    options.conditional === true ? (previous?.etag ?? null) : null
  )
  return {
    stateId: written.stateId,
    bodyId: written.bodyId,
    parentStateId: previous?.head.stateId ?? null
  }
}

export type ResolvedVersion = {
  head: DocumentHead
  manifest: VersionManifest
  authoritative: boolean
}

/** Resolve head and manifest; null when the document has no versioned head (yet). */
export async function s3ResolveVersion(
  config: S3CompatibleConfig,
  id: string,
  fallback: StorageDocumentMetadata
): Promise<ResolvedVersion | null> {
  const head = parseDocumentHead(await getObject(config, documentHeadKey(id)))
  if (!head) return null
  const parsed = await readVersionManifest(config, head.stateId, fallback)
  if (!parsed) return null
  return { head, manifest: parsed.manifest, authoritative: parsed.authoritative }
}

/** Versioned body read; null when there is no head, so the caller reads the legacy layout. */
export async function s3GetVersionedBody(
  config: S3CompatibleConfig,
  id: string,
  fallback: StorageDocumentMetadata,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<(ResolvedVersion & { bytes: Uint8Array }) | null> {
  const version = await s3ResolveVersion(config, id, fallback)
  if (!version) return null
  const bytes = await getObject(config, bodyKey(version.manifest.bodyId), onProgress, signal)
  if (!bytes) throw new Error(`Document body missing: ${id}`)
  return { ...version, bytes }
}

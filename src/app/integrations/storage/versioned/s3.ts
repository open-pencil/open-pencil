import { StorageConflictError } from '../conflict'
import { bodyKey, documentHeadKey, versionManifestKey } from '../namespace'
import {
  S3HttpError,
  getObject,
  headObject,
  objectUrl,
  putObject,
  putObjectResumable,
  s3Request,
  type DownloadProgress,
  type UploadProgress
} from '../s3/client'
import type { S3CompatibleConfig } from '../s3/types'
import type { CommittedVersion, StorageDocumentMetadata } from '../types'
import {
  nextDocumentHead,
  parseDocumentHead,
  serializeDocumentHead,
  type DocumentHead
} from './head'
import {
  parseVersionManifest,
  serializeVersionManifest,
  VERSION_MANIFEST_SCHEMA,
  type VersionManifest
} from './manifest'

export class MissingVersionIdentityError extends Error {
  constructor(id: string) {
    super(`Version commit for ${id} lacks bodyId/stateId — identity must be computed before commit`)
    this.name = 'MissingVersionIdentityError'
  }
}

/**
 * The versioned commit: body → manifest → head, in that order, head last.
 * A crash anywhere before the head update leaves orphans (a GC problem,
 * bounded) but never a visible tear (a correctness problem, unbounded).
 * `readWritten` runs again AFTER the body upload so a rename landing
 * mid-upload is already in the committed manifest — the same completion-time
 * rule the fixed-key sidecar writer follows.
 */
export async function s3CommitVersion(
  config: S3CompatibleConfig,
  id: string,
  bytes: Uint8Array | null,
  readWritten: () => Promise<StorageDocumentMetadata>,
  onUploadProgress?: (progress: UploadProgress) => void,
  options: { conditional?: boolean } = {}
): Promise<CommittedVersion> {
  const dispatched = await readWritten()
  if (!dispatched.bodyId || !dispatched.stateId) throw new MissingVersionIdentityError(id)

  if (bytes !== null && !(await headObject(config, bodyKey(dispatched.bodyId)))) {
    // Content-addressed: an existing body object is never re-transferred.
    await putObjectResumable(
      config,
      bodyKey(dispatched.bodyId),
      bytes,
      'application/octet-stream',
      onUploadProgress
    )
  }
  const written = bytes !== null ? await readWritten() : dispatched

  const stateId = written.stateId
  const bodyId = written.bodyId
  if (!stateId || !bodyId) throw new MissingVersionIdentityError(id)
  await putObject(
    config,
    versionManifestKey(stateId),
    serializeVersionManifest({ schema: VERSION_MANIFEST_SCHEMA, bodyId, metadata: written }),
    'application/json'
  )
  const previous = await readHeadWithEtag(config, id)
  await writeHead(
    config,
    id,
    nextDocumentHead(stateId, previous?.head ?? null),
    options.conditional === true ? (previous?.etag ?? null) : null
  )
  return { stateId, bodyId }
}

async function readHeadWithEtag(
  config: S3CompatibleConfig,
  id: string
): Promise<{ head: DocumentHead; etag: string | null } | null> {
  const res = await s3Request(config, objectUrl(config, documentHeadKey(id)), {
    method: 'GET'
  }).catch(() => null)
  if (!res || res.status === 404) return null
  const head = parseDocumentHead(new Uint8Array(await res.arrayBuffer()))
  if (!head) return null
  return { head, etag: res.headers.get('etag') }
}

/**
 * The head update, optionally compare-and-swap. `If-Match` on the head's own
 * ETag turns a lost race into HTTP 412 instead of a silent overwrite — but
 * only where a live probe verified conditional writes (providers without CAS
 * never enable it, and races there degrade to recoverable forks).
 */
async function writeHead(
  config: S3CompatibleConfig,
  id: string,
  head: DocumentHead,
  ifMatch: string | null
): Promise<void> {
  // Bytes, not a string body: R2 answers string (chunked) uploads with weak
  // W/ etags, and If-Match must not match weak validators (RFC 7232) — which
  // turned our own next commit into a spurious 412. Belt-and-braces, a weak
  // validator is never sent as If-Match either; the commit then degrades to
  // the non-conditional path (detection still covers the race).
  const strongMatch = ifMatch !== null && !ifMatch.startsWith('W/') ? ifMatch : null
  try {
    await s3Request(config, objectUrl(config, documentHeadKey(id)), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(strongMatch !== null ? { 'If-Match': strongMatch } : {})
      },
      body: new TextEncoder().encode(serializeDocumentHead(head))
    })
  } catch (error) {
    if (error instanceof S3HttpError && error.status === 412) {
      throw new StorageConflictError(
        `"${id}" changed on another device while this commit was in flight; the conditional head update refused the overwrite.`
      )
    }
    throw error
  }
}

/** Resolve head → manifest. Null when the document is not versioned (yet). */
export async function s3ResolveVersion(
  config: S3CompatibleConfig,
  id: string,
  fallback: StorageDocumentMetadata
): Promise<{ head: DocumentHead; manifest: VersionManifest; authoritative: boolean } | null> {
  const head = parseDocumentHead(await getObject(config, documentHeadKey(id)).catch(() => null))
  if (!head) return null
  const parsed = parseVersionManifest(
    await getObject(config, versionManifestKey(head.stateId)).catch(() => null),
    fallback
  )
  if (!parsed) return null
  return { head, manifest: parsed.manifest, authoritative: parsed.authoritative }
}

/** Versioned body read; null when no head exists (caller falls back to legacy). */
export async function s3GetVersionedBody(
  config: S3CompatibleConfig,
  id: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Uint8Array | null> {
  const version = await s3ResolveVersion(config, id, {
    name: id,
    updatedAt: new Date(0).toISOString(),
    sourceFormat: 'fig',
    trashedAt: null
  })
  if (!version) return null
  return getObject(config, bodyKey(version.manifest.bodyId), onProgress)
}

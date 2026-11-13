import { isEqual } from 'es-toolkit'
import { unzipSync } from 'fflate'

import {
  prepareCloudDocument,
  saveCloudDocument,
  type CloudAPIClient,
  type CloudObjectFetch,
  type PreparedCloudDocument
} from '@open-pencil/cloud/client'
import type { DocumentSummary } from '@open-pencil/cloud/contract'
import { figArchiveKind } from '@open-pencil/fig'

/** What publishing needs of the API client, so tests can pass a fake one. */
export type GalleryClient = Pick<
  CloudAPIClient,
  | 'listDocuments'
  | 'createDocument'
  | 'getDocument'
  | 'listDocumentVersions'
  | 'saveDocumentVersion'
  | 'requestImageUploads'
  | 'commitImageUploads'
  | 'createUpload'
  | 'commitUpload'
>

/** A release the examples are published for, named as a version of each. */
export type GalleryRelease = { name: string; description: string }

/** What publishing did to one example's document. */
export type ExampleOutcome = {
  name: string
  documentId: string
  created: boolean
  uploaded: boolean
  /** Whether the release was named now, already was, or none was given. */
  version: 'named' | 'existing' | null
}

/** The workspace document an example is published as, by its exact name; one at most. */
async function exampleDocument(
  cloud: GalleryClient,
  workspaceId: string,
  name: string
): Promise<DocumentSummary | null> {
  const matches = (await cloud.listDocuments(workspaceId)).filter(
    (document) => document.name === name
  )
  if (matches.length > 1) {
    throw new Error(`The gallery has ${matches.length} documents named "${name}"; keep one`)
  }
  return matches[0] ?? null
}

/** Whether the document has a named version called `name`, looking through all of its history. */
async function hasNamedVersion(
  cloud: GalleryClient,
  documentId: string,
  name: string
): Promise<boolean> {
  let before: string | undefined
  for (;;) {
    const page = await cloud.listDocumentVersions(documentId, { before, limit: 100 })
    if (page.versions.some((version) => version.kind === 'named' && version.name === name)) {
      return true
    }
    if (!page.nextCursor) return false
    before = page.nextCursor
  }
}

/** An archive's entries by name, unpacked, so two archives compare by what they hold. */
function entries(archive: Uint8Array): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(unzipSync(archive)).map(([name, bytes]) => [name, [...bytes]])
  )
}

/**
 * Whether the document's current revision holds what `prepared` does: the same images and the same
 * entries in the stored file. Splitting writes new timestamps into the archive, so its checksum
 * changes on every run and only the contents tell an unchanged file.
 */
async function storedMatches(
  cloud: GalleryClient,
  documentId: string,
  prepared: PreparedCloudDocument,
  objectFetch: CloudObjectFetch
): Promise<boolean> {
  const stored = await cloud.getDocument(documentId)
  const checksums = (images: { checksum: string }[]) =>
    images.map((image) => image.checksum).sort((a, b) => a.localeCompare(b))
  if (!isEqual(checksums(stored.images), checksums(prepared.images))) return false
  if (stored.checksum === prepared.checksum) return true
  const response = await objectFetch(stored.download.url, {
    method: stored.download.method,
    headers: stored.download.headers
  })
  if (!response.ok) throw new Error(`The stored file answered HTTP ${response.status}`)
  return isEqual(entries(new Uint8Array(await response.arrayBuffer())), entries(prepared.lean))
}

/**
 * Publishes one example to the gallery workspace as the editor saves a document: created on its
 * first run, a new revision only when the file changed, and, for a release, its current state
 * named after it once. Running it again with the same file and release changes nothing.
 */
export async function publishExample(input: {
  cloud: GalleryClient
  workspaceId: string
  name: string
  bytes: Uint8Array
  release?: GalleryRelease
  objectFetch: CloudObjectFetch
}): Promise<ExampleOutcome> {
  const { cloud, workspaceId, name } = input
  const kind = figArchiveKind(input.bytes) ?? 'design'
  const existing = await exampleDocument(cloud, workspaceId, name)
  const document = existing ?? (await cloud.createDocument(workspaceId, { name, kind }))
  const prepared = await prepareCloudDocument(input.bytes)
  const uploaded =
    !document.currentRevisionId ||
    !(await storedMatches(cloud, document.id, prepared, input.objectFetch))
  if (uploaded) {
    await saveCloudDocument({
      cloud,
      documentId: document.id,
      document: prepared,
      name,
      kind,
      baseRevision: document.currentRevisionId,
      objectFetch: input.objectFetch
    })
  }
  let version: ExampleOutcome['version'] = null
  if (input.release) {
    if (await hasNamedVersion(cloud, document.id, input.release.name)) version = 'existing'
    else {
      await cloud.saveDocumentVersion(document.id, input.release)
      version = 'named'
    }
  }
  return { name, documentId: document.id, created: !existing, uploaded, version }
}

/** One line for the log: what happened to an example's document. */
export function describeOutcome(outcome: ExampleOutcome): string {
  const steps = [
    outcome.created ? 'created' : null,
    outcome.uploaded ? 'uploaded a new revision' : 'unchanged',
    outcome.version === 'named' ? 'named the release' : null,
    outcome.version === 'existing' ? 'release already named' : null
  ].filter((step) => step !== null)
  return `${outcome.name} (${outcome.documentId}): ${steps.join(', ')}`
}

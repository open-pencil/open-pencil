import { contentHash } from './hash'
import { serializeLibraryRevision } from './serialization'
import { describeSnapshotAssets } from './snapshot'
import type { ComponentLibraryRevision } from './types'

export const MAX_LIBRARY_REVISION_BYTES = 50 * 1024 * 1024
export const MAX_LIBRARY_NODES = 50_000
export const MAX_LIBRARY_IMAGES = 500
export const MAX_LIBRARY_IMAGE_BYTES = MAX_LIBRARY_REVISION_BYTES

export class LibraryRevisionIntegrityError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LibraryRevisionIntegrityError'
  }
}

export function isLibraryRevisionIntegrityError(
  error: unknown
): error is LibraryRevisionIntegrityError {
  return error instanceof LibraryRevisionIntegrityError
}

function integrityError(message: string): never {
  throw new LibraryRevisionIntegrityError(message)
}

function serializedRevisionBytes(revision: ComponentLibraryRevision): number {
  const serialized = serializeLibraryRevision(revision)
  return new TextEncoder().encode(JSON.stringify(serialized)).byteLength
}

export async function validateLibraryRevision(revision: ComponentLibraryRevision): Promise<void> {
  const { manifest, graph } = revision
  if (graph.nodes.size > MAX_LIBRARY_NODES) integrityError('Component library exceeds node limit')
  if (graph.images.size > MAX_LIBRARY_IMAGES)
    integrityError('Component library exceeds image limit')
  const imageBytes = [...graph.images.values()].reduce(
    (total, image) => total + image.byteLength,
    0
  )
  if (imageBytes > MAX_LIBRARY_IMAGE_BYTES)
    integrityError('Component library exceeds image byte limit')
  if (serializedRevisionBytes(revision) > MAX_LIBRARY_REVISION_BYTES)
    integrityError('Component library exceeds serialized revision byte limit')

  const assetKeys = new Set<string>()
  for (const asset of manifest.assets) {
    if (assetKeys.has(asset.key))
      integrityError(`Duplicate component library asset key: ${asset.key}`)
    assetKeys.add(asset.key)
    const source = graph.getNode(asset.sourceNodeId)
    if (source && source.type !== asset.type)
      integrityError(`Component library asset type mismatch: ${asset.key}`)
  }

  const roots = manifest.assets.flatMap((asset) => {
    const node = graph.getNode(asset.sourceNodeId)
    return node ? [node] : []
  })
  if (roots.length !== manifest.assets.length)
    integrityError('Component library asset source is missing')
  const described = await describeSnapshotAssets({ graph, assetRoots: roots })
  const hashes = new Map(described.map((asset) => [asset.key, asset.contentHash]))
  for (const asset of manifest.assets) {
    if (hashes.get(asset.key) !== asset.contentHash) {
      integrityError(`Component library content hash mismatch: ${asset.key}`)
    }
  }
  const revisionId = await contentHash({
    schemaVersion: manifest.schemaVersion,
    libraryId: manifest.libraryId,
    previousRevisionId: manifest.previousRevisionId,
    assets: manifest.assets.map(({ thumbnail: _, sourceNodeId: __, ...asset }) => asset)
  })
  if (revisionId !== manifest.revisionId) integrityError('Component library revision hash mismatch')
}

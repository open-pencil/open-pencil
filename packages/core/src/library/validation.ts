import type { SceneNode, VariableCollection } from '@open-pencil/scene-graph'

import { libraryRevisionId } from './revision'
import { encodeStoredLibraryRevision } from './serialization'
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
  return new TextEncoder().encode(JSON.stringify(encodeStoredLibraryRevision(revision))).byteLength
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
  const roots: SceneNode[] = []
  const collections: VariableCollection[] = []
  for (const asset of manifest.assets) {
    if (assetKeys.has(asset.key))
      integrityError(`Duplicate component library asset key: ${asset.key}`)
    assetKeys.add(asset.key)
    if (asset.type === 'VARIABLE_COLLECTION') {
      const collection = graph.variableCollections.get(asset.sourceId)
      if (!collection) integrityError(`Component library asset source is missing: ${asset.key}`)
      collections.push(collection)
      continue
    }
    const node = graph.getNode(asset.sourceId)
    if (!node) integrityError(`Component library asset source is missing: ${asset.key}`)
    const style = node.sharedStyleType !== null
    if (asset.type === 'STYLE' ? !style : style || node.type !== asset.type)
      integrityError(`Component library asset type mismatch: ${asset.key}`)
    roots.push(node)
  }

  const described = await describeSnapshotAssets({ graph, assetRoots: roots, collections })
  const hashes = new Map(described.map((asset) => [asset.key, asset.contentHash]))
  for (const asset of manifest.assets) {
    if (hashes.get(asset.key) !== asset.contentHash) {
      integrityError(`Component library content hash mismatch: ${asset.key}`)
    }
  }
  if ((await libraryRevisionId(manifest)) !== manifest.revisionId)
    integrityError('Component library revision hash mismatch')
}

import { contentHash } from './hash'
import { describeSnapshotAssets } from './snapshot'
import type { ComponentLibraryRevision } from './types'

export const MAX_LIBRARY_REVISION_BYTES = 50 * 1024 * 1024
export const MAX_LIBRARY_NODES = 50_000
export const MAX_LIBRARY_IMAGES = 500
export const MAX_LIBRARY_IMAGE_BYTES = 200 * 1024 * 1024

export async function validateLibraryRevision(revision: ComponentLibraryRevision): Promise<void> {
  const { manifest, graph } = revision
  if (graph.nodes.size > MAX_LIBRARY_NODES) throw new Error('Component library exceeds node limit')
  if (graph.images.size > MAX_LIBRARY_IMAGES)
    throw new Error('Component library exceeds image limit')
  const imageBytes = [...graph.images.values()].reduce(
    (total, image) => total + image.byteLength,
    0
  )
  if (imageBytes > MAX_LIBRARY_IMAGE_BYTES)
    throw new Error('Component library exceeds image byte limit')

  const roots = manifest.assets.flatMap((asset) => {
    const node = graph.getNode(asset.sourceNodeId)
    return node ? [node] : []
  })
  if (roots.length !== manifest.assets.length)
    throw new Error('Component library asset source is missing')
  const described = await describeSnapshotAssets({ graph, assetRoots: roots })
  const hashes = new Map(described.map((asset) => [asset.key, asset.contentHash]))
  for (const asset of manifest.assets) {
    if (hashes.get(asset.key) !== asset.contentHash) {
      throw new Error(`Component library content hash mismatch: ${asset.key}`)
    }
  }
  const revisionId = await contentHash({
    schemaVersion: manifest.schemaVersion,
    libraryId: manifest.libraryId,
    previousRevisionId: manifest.previousRevisionId,
    assets: manifest.assets.map(({ thumbnail: _, sourceNodeId: __, ...asset }) => asset)
  })
  if (revisionId !== manifest.revisionId)
    throw new Error('Component library revision hash mismatch')
}

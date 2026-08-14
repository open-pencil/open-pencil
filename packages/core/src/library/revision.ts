import { contentHash } from './hash'
import { assertLibraryId } from './identity'
import { describeSnapshotAssets, extractLibrarySnapshot } from './snapshot'
import { COMPONENT_LIBRARY_SCHEMA_VERSION } from './types'
import type {
  ComponentLibraryManifest,
  ComponentLibraryRevision,
  PublishLibraryInput
} from './types'

export async function createLibraryRevision(
  input: PublishLibraryInput
): Promise<ComponentLibraryRevision> {
  assertLibraryId(input.libraryId)
  const snapshot = extractLibrarySnapshot(input.graph, input.assetNodeIds)
  const assets = await describeSnapshotAssets(snapshot)
  const revisionId = await contentHash({
    schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
    libraryId: input.libraryId,
    previousRevisionId: input.previousRevisionId ?? null,
    assets: assets.map(({ thumbnail: _, sourceNodeId: __, ...asset }) => asset)
  })
  const manifest: ComponentLibraryManifest = {
    schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
    libraryId: input.libraryId,
    name: input.name.trim(),
    revisionId,
    previousRevisionId: input.previousRevisionId ?? null,
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    description: input.description?.trim() ?? '',
    assets
  }
  return { manifest, graph: snapshot.graph }
}

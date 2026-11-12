import { omit } from 'es-toolkit'

import { contentHash } from './hash'
import { assertLibraryId } from './identity'
import { describeSnapshotAssets, extractLibrarySnapshot } from './snapshot'
import { renderLibraryThumbnails } from './thumbnails'
import { COMPONENT_LIBRARY_SCHEMA_VERSION } from './types'
import type {
  ComponentLibraryManifest,
  ComponentLibraryRevision,
  PublishLibraryInput
} from './types'

/**
 * A revision's ID: the hash of its library, the revision it follows, and its assets' content.
 * Where a revision keeps an asset and the picture of it are not content.
 */
export function libraryRevisionId(
  manifest: Pick<
    ComponentLibraryManifest,
    'schemaVersion' | 'libraryId' | 'previousRevisionId' | 'assets'
  >
): Promise<string> {
  return contentHash({
    schemaVersion: manifest.schemaVersion,
    libraryId: manifest.libraryId,
    previousRevisionId: manifest.previousRevisionId,
    assets: manifest.assets.map((asset) => omit(asset, ['thumbnail', 'sourceId']))
  })
}

export async function createLibraryRevision(
  input: PublishLibraryInput
): Promise<ComponentLibraryRevision> {
  assertLibraryId(input.libraryId)
  const snapshot = extractLibrarySnapshot(input.graph, input.assetIds, input.keepLayerIdentities)
  const assets = await describeSnapshotAssets(snapshot)
  const previousRevisionId = input.previousRevisionId ?? null
  const revisionId = await libraryRevisionId({
    schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
    libraryId: input.libraryId,
    previousRevisionId,
    assets
  })
  const manifest: ComponentLibraryManifest = {
    schemaVersion: COMPONENT_LIBRARY_SCHEMA_VERSION,
    libraryId: input.libraryId,
    name: input.name.trim(),
    revisionId,
    previousRevisionId,
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    description: input.description?.trim() ?? '',
    assets
  }
  const revision = { manifest, graph: snapshot.graph }
  if (input.renderThumbnail) await renderLibraryThumbnails(revision, input.renderThumbnail)
  return revision
}

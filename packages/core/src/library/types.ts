import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export const COMPONENT_LIBRARY_SCHEMA_VERSION = 1 as const

export type LibraryAssetType = 'COMPONENT' | 'COMPONENT_SET'

export interface LibraryAssetDescriptor {
  key: string
  type: LibraryAssetType
  name: string
  description: string
  sourceNodeId: string
  contentHash: string
  thumbnail?: Uint8Array
}

export interface ComponentLibraryManifest {
  schemaVersion: typeof COMPONENT_LIBRARY_SCHEMA_VERSION
  libraryId: string
  name: string
  revisionId: string
  previousRevisionId: string | null
  publishedAt: string
  description: string
  assets: LibraryAssetDescriptor[]
}

export interface ComponentLibraryRevision {
  manifest: ComponentLibraryManifest
  graph: SceneGraph
}

export interface PublishLibraryInput {
  libraryId: string
  name: string
  graph: SceneGraph
  description?: string
  previousRevisionId?: string | null
  assetNodeIds?: string[]
  publishedAt?: string
}

export interface LibrarySummary {
  libraryId: string
  name: string
  latestRevisionId: string
  publishedAt: string
  assetCount: number
}

export interface StoredLibraryLatestManifest {
  schemaVersion: typeof COMPONENT_LIBRARY_SCHEMA_VERSION
  summary: LibrarySummary
}

export interface LibraryCatalog {
  listLibraries(): Promise<LibrarySummary[]>
  getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision>
  publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision>
}

export type LibraryAssetChange =
  | { kind: 'added'; asset: LibraryAssetDescriptor }
  | { kind: 'removed'; asset: LibraryAssetDescriptor }
  | {
      kind: 'modified' | 'renamed'
      previous: LibraryAssetDescriptor
      asset: LibraryAssetDescriptor
    }

export interface PortableLibrarySnapshot {
  graph: SceneGraph
  assetRoots: SceneNode[]
}

import type { SceneGraph, SceneNode, VariableCollection } from '@open-pencil/scene-graph'

import type { LibraryThumbnailRenderer } from './thumbnails'

export const COMPONENT_LIBRARY_SCHEMA_VERSION = 2 as const

/** What a library publishes: components and sets to insert, shared styles, and variable collections. */
export type LibraryAssetType = 'COMPONENT' | 'COMPONENT_SET' | 'STYLE' | 'VARIABLE_COLLECTION'

export type LibraryComponentAssetType = Extract<LibraryAssetType, 'COMPONENT' | 'COMPONENT_SET'>

export interface LibraryAssetDescriptor {
  key: string
  type: LibraryAssetType
  name: string
  description: string
  /** The revision's layer for a component, set, or style; its collection for a collection. */
  sourceId: string
  contentHash: string
  /** A PNG of the asset as published, for catalogs that cannot draw the revision. */
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
  /** The components, sets, styles, and collections to publish; every publishable one by default. */
  assetIds?: string[]
  publishedAt?: string
  /** Draws the components' thumbnails; a revision published without it has none. */
  renderThumbnail?: LibraryThumbnailRenderer
  /**
   * The graph holds layers copied from revisions, as a selective publication's does, so each
   * keeps the layer identity it carries and updates pair it with the layer it was.
   */
  keepLayerIdentities?: boolean
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
  /** The published components, sets, and styles, as the snapshot's layers. */
  assetRoots: SceneNode[]
  /** The published collections, as the snapshot's. */
  collections: VariableCollection[]
}

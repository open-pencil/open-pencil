import * as v from 'valibot'

import type { SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

import type { SerializedComponentLibraryRevision } from './serialization'
import { COMPONENT_LIBRARY_SCHEMA_VERSION } from './types'
import type { LibrarySummary, StoredLibraryLatestManifest } from './types'

const SerializedNodeShape = v.looseObject({
  id: v.string(),
  type: v.string(),
  parentId: v.nullable(v.string()),
  childIds: v.array(v.string()),
  // Asset keys fall back to `source.id`, which is null for nodes that never came from a file.
  source: v.looseObject({ id: v.nullable(v.string()) })
})

const SerializedVariableShape = v.looseObject({
  id: v.string(),
  collectionId: v.string(),
  valuesByMode: v.record(v.string(), v.unknown())
})

const SerializedCollectionShape = v.looseObject({
  id: v.string(),
  modes: v.array(v.unknown()),
  variableIds: v.array(v.string())
})

/**
 * Library revisions come from shared catalogs. Nodes, variables and collections are checked for
 * the fields deserialization and integrity validation dereference; the remaining fields pass
 * through, since a full SceneNode schema would duplicate the Scene Graph types.
 */
const SerializedNode = v.custom<SceneNode>((value) => v.is(SerializedNodeShape, value))
const SerializedVariable = v.custom<Variable>((value) => v.is(SerializedVariableShape, value))
const SerializedCollection = v.custom<VariableCollection>((value) =>
  v.is(SerializedCollectionShape, value)
)

/** Image bytes: a Uint8Array, or the index-keyed object `JSON.stringify` writes for one. */
const SerializedBytes = v.union([
  v.instance(Uint8Array),
  v.pipe(
    v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255))),
    // A gap or a stray key would silently shift the bytes; asset hashes do not cover images.
    v.check(
      (bytes) => Object.keys(bytes).every((key, index) => key === String(index)),
      'Expected byte indexes 0 to length - 1'
    ),
    v.transform((bytes) => Uint8Array.from(Object.values(bytes)))
  )
])

const LibraryAssetDescriptor = v.object({
  key: v.string(),
  type: v.picklist(['COMPONENT', 'COMPONENT_SET']),
  name: v.string(),
  description: v.string(),
  sourceNodeId: v.string(),
  contentHash: v.string(),
  thumbnail: v.optional(SerializedBytes)
})

export const SerializedLibraryRevisionSchema = v.object({
  manifest: v.object({
    schemaVersion: v.literal(COMPONENT_LIBRARY_SCHEMA_VERSION),
    libraryId: v.string(),
    name: v.string(),
    revisionId: v.string(),
    previousRevisionId: v.nullable(v.string()),
    publishedAt: v.string(),
    description: v.string(),
    assets: v.array(LibraryAssetDescriptor)
  }),
  graph: v.object({
    rootId: v.string(),
    nodes: v.array(v.tuple([v.string(), SerializedNode])),
    images: v.array(v.tuple([v.string(), SerializedBytes])),
    variables: v.array(v.tuple([v.string(), SerializedVariable])),
    variableCollections: v.array(v.tuple([v.string(), SerializedCollection])),
    activeMode: v.array(v.tuple([v.string(), v.string()])),
    documentColorSpace: v.picklist(['srgb', 'display-p3'])
  })
}) satisfies v.GenericSchema<unknown, SerializedComponentLibraryRevision>

export const LibrarySummarySchema = v.object({
  libraryId: v.string(),
  name: v.string(),
  latestRevisionId: v.string(),
  publishedAt: v.string(),
  assetCount: v.pipe(v.number(), v.safeInteger(), v.minValue(0))
}) satisfies v.GenericSchema<unknown, LibrarySummary>

export const StoredLibraryLatestManifestSchema = v.object({
  schemaVersion: v.literal(COMPONENT_LIBRARY_SCHEMA_VERSION),
  summary: LibrarySummarySchema
}) satisfies v.GenericSchema<unknown, StoredLibraryLatestManifest>

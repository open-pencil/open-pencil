import * as v from 'valibot'

import type { SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

import { decodeStoredLibraryValue } from './serialization'
import type { SerializedComponentLibraryRevision } from './serialization'
import { COMPONENT_LIBRARY_SCHEMA_VERSION } from './types'
import type { LibrarySummary, StoredLibraryLatestManifest } from './types'

const serializedNodeShapeSchema = v.looseObject({
  id: v.string(),
  type: v.string(),
  parentId: v.nullable(v.string()),
  childIds: v.array(v.string()),
  // Asset keys fall back to `source.id`, which is null for nodes that never came from a file.
  source: v.looseObject({ id: v.nullable(v.string()) })
})

const serializedVariableShapeSchema = v.looseObject({
  id: v.string(),
  collectionId: v.string(),
  valuesByMode: v.record(v.string(), v.unknown())
})

const serializedCollectionShapeSchema = v.looseObject({
  id: v.string(),
  modes: v.array(v.unknown()),
  variableIds: v.array(v.string())
})

/**
 * Library revisions come from shared catalogs. Nodes, variables and collections are checked for
 * the fields deserialization and integrity validation dereference; the remaining fields pass
 * through, since a full SceneNode schema would duplicate the Scene Graph types.
 */
const serializedNodeSchema = v.custom<SceneNode>((value) => v.is(serializedNodeShapeSchema, value))
const serializedVariableSchema = v.custom<Variable>((value) =>
  v.is(serializedVariableShapeSchema, value)
)
const serializedCollectionSchema = v.custom<VariableCollection>((value) =>
  v.is(serializedCollectionShapeSchema, value)
)

const serializedBytesSchema = v.instance(Uint8Array)

const libraryAssetDescriptorSchema = v.object({
  key: v.string(),
  type: v.picklist(['COMPONENT', 'COMPONENT_SET']),
  name: v.string(),
  description: v.string(),
  sourceNodeId: v.string(),
  contentHash: v.string(),
  thumbnail: v.optional(serializedBytesSchema)
})

export const serializedLibraryRevisionSchema = v.object({
  manifest: v.object({
    schemaVersion: v.literal(COMPONENT_LIBRARY_SCHEMA_VERSION),
    libraryId: v.string(),
    name: v.string(),
    revisionId: v.string(),
    previousRevisionId: v.nullable(v.string()),
    publishedAt: v.string(),
    description: v.string(),
    assets: v.array(libraryAssetDescriptorSchema)
  }),
  graph: v.object({
    rootId: v.string(),
    nodes: v.array(v.tuple([v.string(), serializedNodeSchema])),
    images: v.array(v.tuple([v.string(), serializedBytesSchema])),
    variables: v.array(v.tuple([v.string(), serializedVariableSchema])),
    variableCollections: v.array(v.tuple([v.string(), serializedCollectionSchema])),
    activeMode: v.array(v.tuple([v.string(), v.string()])),
    documentColorSpace: v.picklist(['srgb', 'display-p3'])
  })
}) satisfies v.GenericSchema<unknown, SerializedComponentLibraryRevision>

/** A revision as a catalog reads it back from JSON, decoded from `encodeStoredLibraryRevision`. */
export const storedLibraryRevisionSchema = v.pipe(
  v.unknown(),
  v.transform(decodeStoredLibraryValue),
  serializedLibraryRevisionSchema
)

export const librarySummarySchema = v.object({
  libraryId: v.string(),
  name: v.string(),
  latestRevisionId: v.string(),
  publishedAt: v.string(),
  assetCount: v.pipe(v.number(), v.safeInteger(), v.minValue(0))
}) satisfies v.GenericSchema<unknown, LibrarySummary>

export const storedLibraryLatestManifestSchema = v.object({
  schemaVersion: v.literal(COMPONENT_LIBRARY_SCHEMA_VERSION),
  summary: librarySummarySchema
}) satisfies v.GenericSchema<unknown, StoredLibraryLatestManifest>

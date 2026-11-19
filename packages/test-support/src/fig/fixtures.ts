import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { collectAllNodes } from '#test-support/fig/traversal'
import { FIXTURES, readFixtureArrayBuffer } from '#test-support/paths'
import * as v from 'valibot'

import { parseFigFile, type ParseFigFileOptions } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export const VALID_NODE_TYPES = new Set<string>([
  'CANVAS',
  'FRAME',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'LINE',
  'STAR',
  'POLYGON',
  'VECTOR',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'BOOLEAN_OPERATION',
  'CONNECTOR',
  'SHAPE_WITH_TEXT',
  'STICKY'
])

/** Read a shared JSON fixture and validate it; a module import would escape the package root. */
export function readFixture<TSchema extends v.GenericSchema>(
  name: string,
  schema: TSchema
): v.InferOutput<TSchema> {
  return v.parse(
    v.pipe(v.string(), v.parseJson(), schema),
    readFileSync(resolve(FIXTURES, name), 'utf8')
  )
}

export async function parseFixture(
  name: string,
  options?: ParseFigFileOptions
): Promise<SceneGraph> {
  return parseFigFile(readFixtureArrayBuffer(name), options)
}

export async function parseGoldPreviewFixture(): Promise<{
  graph: SceneGraph
  allNodes: SceneNode[]
}> {
  const graph = await parseFixture('gold-preview.fig')
  return { graph, allNodes: collectAllNodes(graph) }
}

let sharedGoldPreview: ReturnType<typeof parseGoldPreviewFixture> | null = null

/**
 * The fully populated `gold-preview.fig` graph, parsed once per process.
 *
 * Populating its ~38k instance children costs about 3 s and 700 MB, and a
 * shard runs every file in one Bun process, so read-only suites share the
 * result instead of paying that per file. Treat the graph as immutable: a
 * test that creates, updates, deletes or lays out nodes must call
 * `parseGoldPreviewFixture()` for its own copy.
 */
export function sharedGoldPreviewFixture(): ReturnType<typeof parseGoldPreviewFixture> {
  sharedGoldPreview ??= parseGoldPreviewFixture()
  return sharedGoldPreview
}

const LFS_POINTER_PREFIX = 'version https://git-lfs'

/**
 * Read a `.fig` fixture by absolute path, or `null` when it is absent OR an
 * un-fetched Git LFS pointer. `tests/fixtures/*.fig` are LFS-tracked, so on a
 * shallow/LFS-less checkout `existsSync` passes but the bytes are a tiny ASCII
 * pointer stub — parsing it would throw. Optional-local tests skip on `null`.
 * (Contrast `readFixtureBytes`/`parseFixture`, which take a name and assume the
 * fixture is present.)
 */
export function readFigFixture(path: string): ArrayBuffer | null {
  if (!existsSync(path)) return null
  const bytes = readFileSync(path)
  if (
    bytes.length < 1024 &&
    bytes.toString('utf8', 0, LFS_POINTER_PREFIX.length) === LFS_POINTER_PREFIX
  ) {
    return null
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** Parse a `.fig` fixture by path into a SceneGraph, or `null` when unavailable (see readFigFixture). */
export async function loadFigFixture(path: string): Promise<SceneGraph | null> {
  const ab = readFigFixture(path)
  return ab ? parseFigFile(ab) : null
}

const fixtureObjectSchema = v.record(v.string(), v.unknown())

/** Read a shared JSON fixture object. */
export function readFixtureObject(name: string): Record<string, unknown> {
  return readFixture(name, fixtureObjectSchema)
}

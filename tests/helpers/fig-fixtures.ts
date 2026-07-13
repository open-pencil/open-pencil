import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseFigFile } from '@open-pencil/core'
import type { SceneGraph, SceneNode } from '@open-pencil/core'

import { collectAllNodes } from './fig-traversal'

export const FIXTURES = resolve(import.meta.dir, '../fixtures')

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
  'SHAPE_WITH_TEXT'
])

export function readFixtureBytes(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name))
}

export async function parseFixture(name: string): Promise<SceneGraph> {
  const bytes = readFixtureBytes(name)
  return parseFigFile(bytes.buffer as ArrayBuffer)
}

export async function parseGoldPreviewFixture(): Promise<{
  graph: SceneGraph
  allNodes: SceneNode[]
}> {
  const graph = await parseFixture('gold-preview.fig')
  return { graph, allNodes: collectAllNodes(graph) }
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

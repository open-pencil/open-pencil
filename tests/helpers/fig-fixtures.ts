import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseFigFile, type ParseFigFileOptions, type SceneGraph, type SceneNode } from '@open-pencil/core'

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

export function readFixtureArrayBuffer(name: string): ArrayBuffer {
  const bytes = readFixtureBytes(name)
  const buffer = bytes.buffer
  if (buffer instanceof ArrayBuffer)
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
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

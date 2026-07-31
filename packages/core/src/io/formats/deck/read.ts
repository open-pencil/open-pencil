import { parseDeckBuffer } from '@open-pencil/deck'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ParseFigFileOptions } from '#core/io/formats/fig/read'
import { importNodeChanges } from '#core/kiwi/fig/import'

export function parseDeckFileSync(
  buffer: ArrayBuffer | Uint8Array,
  options: ParseFigFileOptions = {}
): SceneGraph {
  const {
    nodeChanges,
    blobs,
    images: imageEntries,
    figKiwiVersion,
    figSchemaDeflated
  } = parseDeckBuffer(buffer)
  const graph = importNodeChanges(nodeChanges, blobs, new Map(imageEntries), options)
  graph.figKiwiVersion = figKiwiVersion
  graph.figSchemaDeflated = figSchemaDeflated
  return graph
}

export async function parseDeckFile(
  buffer: ArrayBuffer | Uint8Array,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  return parseDeckFileSync(buffer, options)
}

export async function readDeckFile(
  file: File,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  return parseDeckFile(await file.arrayBuffer(), options)
}

import { parseDeckBuffer } from '@open-pencil/deck'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ParseFigFileOptions } from '#core/io/formats/fig/read'
import { importNodeChanges } from '#core/kiwi/fig/import'

/** Theme bindings live on the DOCUMENT node and are not modelled by the scene graph. */
function readDeckTheme(nodeChanges: readonly unknown[]): Record<string, unknown> | null {
  const doc = nodeChanges.find(
    (nc): nc is Record<string, unknown> =>
      !!nc && typeof nc === 'object' && (nc as { type?: string }).type === 'DOCUMENT'
  )
  if (!doc) return null
  const theme: Record<string, unknown> = {}
  for (const key of ['themeID', 'sourceLibraryKey', 'slideThemeMap'] as const) {
    if (doc[key] !== undefined) theme[key] = doc[key]
  }
  return Object.keys(theme).length > 0 ? theme : null
}

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
  graph.deckTheme = readDeckTheme(nodeChanges)
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

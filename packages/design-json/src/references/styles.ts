import { wholeLayerWriter, writeLayer, type LayerWriter } from '#design-json/layers'
import { writtenLayers, type References } from '#design-json/references/context'
import { uniq } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import { referencedStyleIds, sharedStyleLayers } from '@open-pencil/scene-graph/shared-styles'

/** The style layers shared styles live in, and the writer that writes them whole. */
interface StyleSource {
  layers: ReadonlyMap<string, SceneNode>
  writer: LayerWriter
}

/**
 * The shared styles the layers and main components use, by the style ID they link them by:
 * fill, stroke, text, effect, and grid styles, and those a text range or vector region uses.
 */
export function addSharedStyles(references: References) {
  const source: StyleSource = {
    layers: sharedStyleLayers(references.writer.graph),
    writer: wholeLayerWriter(references.writer)
  }
  for (const id of styleIdsUsed(references)) addSharedStyle(references, source, id)
}

function styleIdsUsed(references: References): string[] {
  const { graph } = references.writer
  return uniq(
    writtenLayers(references).flatMap((layer) => {
      const node = graph.getNode(layer.id)
      return node ? referencedStyleIds(node) : []
    })
  )
}

function addSharedStyle(references: References, source: StyleSource, id: string) {
  const { styles } = references.document
  if (id in styles) return
  const node = source.layers.get(id)
  if (!node) return
  const written = writeLayer(source.writer, node, 0)
  if (!written) return
  styles[id] = written
}

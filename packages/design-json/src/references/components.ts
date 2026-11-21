import { layersIn, wholeLayerWriter, writeLayer, type LayerWriter } from '#design-json/layers'
import { drain, type References } from '#design-json/references/context'
import type { DesignJSONLayer } from '#design-json/types'

/**
 * The main components of the instances among the layers, each written once and whole, however
 * many instances use it, with the components their own instances use.
 */
export function addMainComponents(references: References) {
  const componentWriter = wholeLayerWriter(references.writer)
  const pending = mainComponentIds(references.document.layers, references)
  drain(pending, (id) => addMainComponent(references, componentWriter, id, pending))
}

function addMainComponent(
  references: References,
  componentWriter: LayerWriter,
  id: string,
  pending: string[]
) {
  const { components } = references.document
  if (id in components) return
  const node = componentWriter.graph.getNode(id)
  if (!node) return
  const written = writeLayer(componentWriter, node, 0)
  if (!written) return
  components[id] = written
  for (const used of mainComponentIds([written], references)) pending.push(used)
}

function mainComponentIds(layers: readonly DesignJSONLayer[], references: References): string[] {
  return [...layersIn(layers)].flatMap((layer) => {
    const id = mainComponentIdOf(layer, references)
    return id ? [id] : []
  })
}

function mainComponentIdOf(layer: DesignJSONLayer, references: References): string | null {
  const { graph } = references.writer
  const node = graph.getNode(layer.id)
  // Only an instance names a main component; the layers copied into it name what they copy.
  if (node?.type !== 'INSTANCE' || !node.componentId) return null
  return graph.getNode(node.componentId) ? node.componentId : null
}

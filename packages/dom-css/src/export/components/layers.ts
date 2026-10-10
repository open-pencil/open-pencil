import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SceneGraphToDesignOptions } from '../projection'
import { claimName, identifierName } from '../storybook/names'
import { componentModel, type GeneratedComponent } from './model'
import { reactComponent } from './react'
import { vueComponent } from './vue'

/** The frameworks a layer can be generated as a component for. */
export const LAYER_COMPONENT_FRAMEWORKS = ['vue', 'react'] as const
export type LayerComponentFramework = (typeof LAYER_COMPONENT_FRAMEWORKS)[number]

/** A layer as a component: its name and the files that make it up. */
export interface LayerComponent {
  name: string
  layerId: string
  files: GeneratedComponent['files']
}

/**
 * Each layer as a Vue or React component, as the Storybook export generates a component set's:
 * a component set with its variants as props and its behaviour's parts, and any other layer as
 * a plain component of the elements it draws. Names stay distinct across the layers.
 */
export async function layerComponents(
  graph: SceneGraph,
  layerIds: readonly string[],
  framework: LayerComponentFramework,
  options: Pick<SceneGraphToDesignOptions, 'vectorElement'> = {}
): Promise<LayerComponent[]> {
  const generate = framework === 'vue' ? vueComponent : reactComponent
  const taken = new Set<string>()
  const components: LayerComponent[] = []
  for (const layerId of layerIds) {
    const layer = graph.getNode(layerId)
    if (!layer) continue
    const name = claimName(identifierName(layer.name, 'Component'), taken)
    const model = componentModel(graph, layer, { ...options, name })
    if (!model) continue
    const { files } = await generate(model)
    components.push({ name, layerId, files })
  }
  return components
}

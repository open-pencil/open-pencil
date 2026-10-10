import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import { stateStyles } from '#dom-css/behaviours/states/model'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractImageAssets, type ExportHTMLFile } from '../bundle'
import { serializeHTML } from '../html'
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

/** Layers as HTML and the stylesheet that styles it, and the images it points at. */
export interface LayerMarkup {
  html: string
  css: string
  images: ExportHTMLFile[]
}

/**
 * Layers as indented HTML with a readable class per layer and one stylesheet, as the generated
 * components draw them, with images as files under `assetBasePath` rather than inlined.
 */
export async function layerMarkup(
  graph: SceneGraph,
  layerIds: readonly string[],
  options: Pick<SceneGraphToDesignOptions, 'vectorElement'> & { assetBasePath?: string } = {}
): Promise<LayerMarkup> {
  const taken = new Set<string>()
  const html: string[] = []
  const css: string[] = []
  for (const layerId of layerIds) {
    const layer = graph.getNode(layerId)
    const styles = layer && stateStyles(graph, layer, options)
    if (!layer || !styles) continue
    // Two layers named alike would share class names, and their rules would collide.
    const name = claimName(styles.name, taken, { separator: ' ' })
    const sheet = await stateStylesToCSS({ ...styles, name })
    html.push(serializeHTML(sheet.document, { indent: true }))
    css.push(sheet.css)
  }
  const { html: page, files } = extractImageAssets(
    html.join('\n\n'),
    options.assetBasePath ?? 'assets'
  )
  return { html: page, css: css.join('\n'), images: files }
}

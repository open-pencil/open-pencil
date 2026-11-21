import { vectorElement } from '@open-pencil/core/io'
import { compactDesign, designToJSON } from '@open-pencil/design-json'
import { selectionToJSXWithLayers } from '@open-pencil/design-jsx'
import {
  layerComponents,
  layerMarkup,
  type ComponentStyling,
  type LayerComponent
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { JSONDetail } from '@/app/code/json-detail'
import { starterSourceFor, type CodeSource } from '@/app/code/templates'

/** Generated code and the layer behind each of its elements, in pre-order. */
export interface GeneratedCode {
  code: string
  layerIds: ReadonlyArray<string | null>
}

/** Sources generated as the panel opens them, which take a moment: components and HTML. */
export type AsyncCodeSource = Exclude<CodeSource, 'design-jsx' | 'json'>

/** Design JSX for the selection, or the starter for writing new layers. */
export function generatedDesignJSX(graph: SceneGraph, nodeIds: string[]): GeneratedCode {
  if (nodeIds.length === 0) return { code: starterSourceFor('design-jsx'), layerIds: [] }
  return selectionToJSXWithLayers(nodeIds, graph)
}

/**
 * The selected layers as JSON. In full, everything `@open-pencil/design-json` writes: every
 * field, what is computed for them, what they reference, and the document's comments. Compact,
 * their structure in brief, with layers drawn inside or over one another nested or grouped. Both
 * list every variable as a token, so they show with nothing selected too.
 */
export function generatedJSON(
  graph: SceneGraph,
  nodeIds: string[],
  detail: JSONDetail
): GeneratedCode {
  const json =
    detail === 'compact'
      ? compactDesign(graph, nodeIds, { inferNesting: true })
      : designToJSON(graph, nodeIds)
  return { code: JSON.stringify(json, null, 2), layerIds: [] }
}

/** Each file of each component under a comment naming it, as a project would hold them. */
function componentFiles(files: readonly LayerComponent['files'][number][]): GeneratedCode {
  const code = files
    .map(({ path, content }) => {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
      if (path.endsWith('.vue')) return `<!-- ${path} -->\n${text}`
      return path.endsWith('.css') ? `/* ${path} */\n${text}` : `// ${path}\n${text}`
    })
    .join('\n')
  return { code, layerIds: files.flatMap((file) => file.layerIds ?? []) }
}

/**
 * Code generated for the selection that takes a moment to make: Vue and React components, as
 * the Storybook export generates them, and the same markup as HTML, images as the files they
 * would be written to rather than inlined. Each is styled with a stylesheet or with Tailwind.
 */
export async function generatedCodeAsync(
  source: AsyncCodeSource,
  styling: ComponentStyling,
  graph: SceneGraph,
  nodeIds: string[]
): Promise<GeneratedCode> {
  if (source === 'html-css') {
    const { html, css, layerIds } = await layerMarkup(graph, nodeIds, { vectorElement, styling })
    // The stylesheet's own element comes first and draws no layer.
    return css
      ? { code: `<style>\n${css}\n</style>\n\n${html}`, layerIds: [null, ...layerIds] }
      : { code: html, layerIds }
  }
  const components = await layerComponents(graph, nodeIds, source, { vectorElement, styling })
  return componentFiles(components.flatMap((component) => component.files))
}

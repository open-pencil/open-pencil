import { vectorElement } from '@open-pencil/core/io'
import { selectionToJSXWithLayers } from '@open-pencil/design-jsx'
import {
  layerComponents,
  layerMarkup,
  sceneNodesToTailwindJSXWithLayers
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { starterSourceFor, type CodeSource } from '@/app/code/templates'

/** Generated code and the layer behind each of its elements, in pre-order. */
export interface GeneratedCode {
  code: string
  layerIds: ReadonlyArray<string | null>
}

/** Sources generated as the panel opens them, which take a moment: components and HTML. */
export type AsyncCodeSource = Extract<CodeSource, 'vue' | 'react' | 'html-css'>

/** Code shown for the selection: editable Design JSX, or read-only Tailwind JSX. */
export function generatedCodeFor(
  source: Extract<CodeSource, 'design-jsx' | 'tailwind-jsx'>,
  graph: SceneGraph,
  nodeIds: string[]
): GeneratedCode {
  if (nodeIds.length === 0) return { code: starterSourceFor(source), layerIds: [] }
  return source === 'tailwind-jsx'
    ? sceneNodesToTailwindJSXWithLayers(graph, nodeIds)
    : selectionToJSXWithLayers(nodeIds, graph)
}

/** Each file of each component under a comment naming it, as a project would hold them. */
function componentFiles(files: readonly { path: string; content: string | Uint8Array }[]): string {
  return files
    .map(({ path, content }) => {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
      if (path.endsWith('.vue')) return `<!-- ${path} -->\n${text}`
      return path.endsWith('.css') ? `/* ${path} */\n${text}` : `// ${path}\n${text}`
    })
    .join('\n')
}

/**
 * Code generated for the selection that takes a moment to make: Vue and React components, as
 * the Storybook export generates them, and the same markup as HTML with its stylesheet, images
 * as the files they would be written to rather than inlined.
 */
export async function generatedCodeAsync(
  source: AsyncCodeSource,
  graph: SceneGraph,
  nodeIds: string[]
): Promise<GeneratedCode> {
  if (source === 'html-css') {
    const { html, css } = await layerMarkup(graph, nodeIds, { vectorElement })
    return { code: `<style>\n${css}\n</style>\n\n${html}`, layerIds: [] }
  }
  const components = await layerComponents(graph, nodeIds, source, { vectorElement })
  return {
    code: componentFiles(components.flatMap((component) => component.files)),
    layerIds: []
  }
}

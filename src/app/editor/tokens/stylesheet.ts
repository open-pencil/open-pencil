import type { TokenStylesheet, TokenStylesheetOptions } from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * The document's variables as a stylesheet. The generator and its CSS parser load with the first
 * preview or copy, since most sessions never show variables as CSS.
 */
export async function variablesStylesheet(
  graph: SceneGraph,
  options: TokenStylesheetOptions
): Promise<TokenStylesheet> {
  const { tokenStylesheet } = await import('@open-pencil/dom-css/export')
  return tokenStylesheet(graph, options)
}

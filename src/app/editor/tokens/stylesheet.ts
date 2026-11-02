import type { TokenStylesheet, TokenStylesheetOptions } from '@lawha/dom-css/export'
import type { SceneGraph } from '@lawha/scene-graph'

/**
 * The document's variables as a stylesheet. The generator and its CSS parser load with the first
 * preview or copy, since most sessions never show variables as CSS.
 */
export async function variablesStylesheet(
  graph: SceneGraph,
  options: TokenStylesheetOptions
): Promise<TokenStylesheet> {
  const { tokenStylesheet } = await import('@lawha/dom-css/export')
  return tokenStylesheet(graph, options)
}

import {
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  htmlToDesignDocument,
  tailwindHTMLToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { layoutAuthoredNodes } from '#core/layout'

export interface ReadHTMLOptions {
  /** A stylesheet applied after the document's own `<style>` blocks. */
  cssText?: string
  /** Tailwind utility candidates compiled into the stylesheet, as the page's classes use. */
  tailwind?: readonly string[]
  pageName?: string
}

export interface ReadHTMLResult {
  /** The styled DOM the layers were built from. */
  styled: DesignDocument
  graph: SceneGraph
}

/**
 * HTML and CSS as a laid-out document, styled by the headless CSS runtime: the layers the
 * markup describes, with the sizes and positions its layout implies.
 */
export async function readHTMLDocument(
  html: string,
  options: ReadHTMLOptions = {}
): Promise<ReadHTMLResult> {
  const runtime = createHeadlessCSSRuntime()
  const styled = options.tailwind
    ? await tailwindHTMLToDesignDocument(html, options.tailwind, { css: options.cssText, runtime })
    : await htmlToDesignDocument(html, { cssText: options.cssText, runtime })
  const graph = designDocumentToSceneGraph(styled, { pageName: options.pageName })
  layoutAuthoredNodes(
    graph,
    graph.getPages().map((page) => page.id)
  )
  return { styled, graph }
}

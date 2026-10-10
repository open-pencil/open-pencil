import {
  createHeadlessCSSRuntime,
  htmlToDesignDocument,
  tailwindHTMLToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { IOFormatAdapter } from '#core/io/types'

import { sceneGraphFromStyledHTML } from './layers'

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
 * HTML and CSS as a laid-out document, styled by the headless CSS runtime. The runtime needs
 * Node, so browser builds style with the browser runtime and call `sceneGraphFromStyledHTML`.
 */
export async function readHTMLDocument(
  html: string,
  options: ReadHTMLOptions = {}
): Promise<ReadHTMLResult> {
  const runtime = createHeadlessCSSRuntime()
  const styled = options.tailwind
    ? await tailwindHTMLToDesignDocument(html, options.tailwind, { css: options.cssText, runtime })
    : await htmlToDesignDocument(html, { cssText: options.cssText, runtime })
  return { styled, graph: sceneGraphFromStyledHTML(styled, { pageName: options.pageName }) }
}

/** Reads HTML files where the headless CSS runtime is available, as in the CLI. */
export const headlessHTMLReader: IOFormatAdapter<'html'> = {
  id: 'html',
  label: 'HTML',
  role: 'interchange-document',
  category: 'document',
  extensions: ['html', 'htm'],
  mimeTypes: ['text/html'],
  support: { readDocument: true },
  async readDocument(input) {
    const { graph } = await readHTMLDocument(new TextDecoder().decode(input.data))
    return { graph, sourceFormat: 'html' }
  }
}

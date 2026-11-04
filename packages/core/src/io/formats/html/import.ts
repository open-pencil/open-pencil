import {
  htmlToDesignDocument,
  tailwindHTMLToDesignDocument,
  type DesignDocument,
  type DesignViewport,
  type HTMLToDesignDocumentOptions
} from '@open-pencil/dom-css'
import { designDocumentToLayers } from '@open-pencil/dom-css/scene-graph'
import {
  createHTMLEngineRuntime,
  loadHTMLEngine,
  type HTMLEngineFetch,
  type HTMLEngineResource
} from '@open-pencil/html-engine'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { IOFormatAdapter } from '#core/io/types'

import { registerLayerFonts, resolvePageFontFamilies } from './fonts'
import { HTML_IMPORT_VIEWPORT, sceneGraphFromStyledHTML } from './layers'

export interface ReadHTMLOptions {
  /** A stylesheet applied after the document's own `<style>` blocks. */
  cssText?: string
  /** Tailwind utility candidates compiled into the stylesheet, as the page's classes use. */
  tailwind?: readonly string[]
  pageName?: string
  /** The page's URL, which its relative URLs resolve against; `file:` URLs are read from disk. */
  baseURL?: string
  /**
   * Reads a file the page names relative to itself, for a host that knows where the page lives
   * without a URL for it, as `ReadDocumentInput.readAsset` does.
   */
  readAsset?: (path: string) => Promise<Uint8Array | null>
  /** The viewport the page is laid out in. */
  viewport?: DesignViewport
}

export interface ReadHTMLResult {
  /** The styled DOM the layers were built from. */
  styled: DesignDocument
  graph: SceneGraph
}

/** The base URL a page without one gets, so its relative URLs reach `readAsset`. */
const ASSET_BASE_URL = 'openpencil-asset:///'

function resource(url: string, bytes: Uint8Array | ArrayBuffer): HTMLEngineResource {
  return { url, bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) }
}

/**
 * Fetches what a page asks for: its own files through `readAsset`, `file:` URLs from disk, and
 * the rest, such as `https:` and `data:`, over the network.
 */
function pageFetch(readAsset: ReadHTMLOptions['readAsset']): HTMLEngineFetch {
  return async (url, signal) => {
    if (url.startsWith(ASSET_BASE_URL)) {
      const path = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
      const bytes = await readAsset?.(path)
      return bytes ? resource(url, bytes) : null
    }
    if (url.startsWith('file:')) {
      const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
      const bytes = await readFile(new URL(url), { signal }).catch(() => null)
      return bytes ? resource(url, bytes) : null
    }
    const response = await fetch(url, { signal }).catch(() => null)
    if (!response?.ok) return null
    return resource(response.url || url, await response.arrayBuffer())
  }
}

/**
 * HTML and CSS laid out as a browser lays them out, with the HTML engine: computed styles, media
 * queries for the viewport, and the boxes that placement keeps auto layout to. Text is set in the
 * first family of its `font-family` list that the font manager has a font for, as a browser picks
 * one, and the engine lays it out in that same font: a page whose text uses fonts the engine has
 * not yet been given is styled once to learn them and again with them. The engine needs WebAssembly and a
 * fetch of its module, so browser builds style with the browser runtime and call
 * `sceneGraphFromStyledHTML`.
 */
export async function readHTMLDocument(
  html: string,
  options: ReadHTMLOptions = {}
): Promise<ReadHTMLResult> {
  const engine = await loadHTMLEngine()
  const runtime = createHTMLEngineRuntime({
    engine: async () => engine,
    baseURL: options.baseURL ?? (options.readAsset ? ASSET_BASE_URL : undefined),
    fetch: pageFetch(options.readAsset)
  })
  const styleOptions: HTMLToDesignDocumentOptions = {
    runtime,
    compute: { layout: true, viewport: options.viewport ?? HTML_IMPORT_VIEWPORT },
    importLinkedStylesheets: true
  }
  const style = async () => {
    const styled = options.tailwind
      ? await tailwindHTMLToDesignDocument(html, options.tailwind, {
          ...styleOptions,
          css: options.cssText
        })
      : await htmlToDesignDocument(html, { ...styleOptions, cssText: options.cssText })
    await resolvePageFontFamilies(styled)
    return styled
  }
  let styled = await style()
  if (await registerLayerFonts(engine, designDocumentToLayers(styled).graph)) styled = await style()
  return { styled, graph: await sceneGraphFromStyledHTML(styled, { pageName: options.pageName }) }
}

/** Reads HTML files where the HTML engine can load, as in the CLI and the MCP server. */
export const headlessHTMLReader: IOFormatAdapter<'html'> = {
  id: 'html',
  label: 'HTML',
  role: 'interchange-document',
  category: 'document',
  extensions: ['html', 'htm'],
  mimeTypes: ['text/html'],
  support: { readDocument: true },
  async readDocument(input) {
    const { graph } = await readHTMLDocument(new TextDecoder().decode(input.data), {
      readAsset: input.readAsset
        ? async (path) => (await input.readAsset?.(path)) ?? null
        : undefined
    })
    return { graph, sourceFormat: 'html' }
  }
}

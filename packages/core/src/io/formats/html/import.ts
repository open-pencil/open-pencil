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

import { registerLayerFonts, registerPageFontFace, resolvePageFontFamilies } from './fonts'
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

/** The media type a file is served as by its extension, for files read without a server. */
function contentTypeOf(url: string): string | undefined {
  return /\.css(?:[?#]|$)/i.test(url) ? 'text/css' : undefined
}

function resource(
  url: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType = contentTypeOf(url)
): HTMLEngineResource {
  return { url, bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), contentType }
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
    const contentType = response.headers.get('content-type') ?? undefined
    return resource(response.url || url, await response.arrayBuffer(), contentType)
  }
}

/**
 * HTML and CSS laid out as a browser lays them out, with the HTML engine: computed styles, media
 * queries for the viewport, and the boxes that placement keeps auto layout to. The fonts a page's
 * `@font-face` rules load go to the font manager, and text is set in the first family of its
 * `font-family` list there is a font for, as a browser picks one. The engine lays text out in that
 * same font: a page whose text uses fonts the engine has
 * not yet been given is styled once to learn them and again with them. The engine needs WebAssembly and a
 * fetch of its module, so browser builds style with the browser runtime and call
 * `sceneGraphFromStyledHTML`.
 */
export async function readHTMLDocument(
  html: string,
  options: ReadHTMLOptions = {}
): Promise<ReadHTMLResult> {
  const engine = await loadHTMLEngine()
  // The page's own fonts, from its `@font-face` rules, which its text may name first.
  const pageFamilies = new Set<string>()
  const runtime = createHTMLEngineRuntime({
    engine: async () => engine,
    baseURL: options.baseURL ?? (options.readAsset ? ASSET_BASE_URL : undefined),
    fetch: pageFetch(options.readAsset),
    onFontFace: async (face) => {
      await registerPageFontFace(face)
      pageFamilies.add(face.family)
    }
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
    await resolvePageFontFamilies(styled, pageFamilies)
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

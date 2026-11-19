import {
  htmlToDesignDocument,
  tailwindHTMLToDesignDocument,
  type DesignDocument,
  type DesignResource,
  type DesignResourceFetch,
  type DesignViewport,
  type HTMLToDesignDocumentOptions
} from '@open-pencil/dom-css'
import { designDocumentToLayers } from '@open-pencil/dom-css/scene-graph'
import { createHTMLEngineRuntime, loadHTMLEngine } from '@open-pencil/html-engine'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { IconMatcher } from '#core/icons/match'
import { mediaTypeOfName, networkResourceFetch, pageResourceFetch } from '#core/io/remote'
import type { IOFormatAdapter } from '#core/io/types'

import {
  registerFallbackFont,
  registerLayerFonts,
  registerPageFontFace,
  resolvePageFontFamilies
} from './fonts'
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
  /** Names the icons inline SVG draws without the page naming them, as `createHeadlessIconMatcher`. */
  matchIcon?: IconMatcher
  /**
   * Puts the page's layers in one frame the size of the window it was laid out in, as a page
   * opened as a document shows; see `sceneGraphFromStyledHTML`.
   */
  framed?: boolean
}

export interface ReadHTMLResult {
  /** The styled DOM the layers were built from. */
  styled: DesignDocument
  graph: SceneGraph
}

/** The base URL a page without one gets, so its relative URLs reach `readAsset`. */
const ASSET_BASE_URL = 'openpencil-asset:///'

function resource(
  url: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType = mediaTypeOfName(new URL(url).pathname)
): DesignResource {
  return { url, bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), contentType }
}

/** The most one stylesheet, font, or image may hold, so one huge file cannot exhaust memory. */
const MAX_RESOURCE_BYTES = 64 * 1024 * 1024

async function readAssetAt(
  url: string,
  readAsset: ReadHTMLOptions['readAsset']
): Promise<DesignResource | null> {
  try {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
    const bytes = await readAsset?.(path)
    return bytes && bytes.byteLength <= MAX_RESOURCE_BYTES ? resource(url, bytes) : null
  } catch {
    // A malformed escape in the URL, or a host that could not read the file.
    return null
  }
}

async function readFileAt(url: string, signal: AbortSignal): Promise<DesignResource | null> {
  const { readFile, stat } = await import(/* @vite-ignore */ 'node:fs/promises')
  const info = await stat(new URL(url)).catch(() => null)
  if (!info?.isFile() || info.size > MAX_RESOURCE_BYTES) return null
  const bytes = await readFile(new URL(url), { signal }).catch(() => null)
  return bytes ? resource(url, bytes) : null
}

const WEB_PROTOCOLS = new Set(['http:', 'https:'])

/** Whether a page lives on the web rather than on disk, so it may not read the computer's files. */
function isWebPage(baseURL: string | undefined): boolean {
  return (
    baseURL !== undefined && URL.canParse(baseURL) && WEB_PROTOCOLS.has(new URL(baseURL).protocol)
  )
}

/** The network part of a page's fetch, such as `https:` and `data:` URLs. */
const fetchFromNetwork = networkResourceFetch(globalThis.fetch, MAX_RESOURCE_BYTES)

/**
 * Fetches what a page asks for: its own files through `readAsset`, `file:` URLs from disk, and
 * the rest, such as `https:` and `data:`, over the network, each up to `MAX_RESOURCE_BYTES`. A
 * page from the web reads nothing from disk, whatever its stylesheets and images name.
 */
function pageFetch(readAsset: ReadHTMLOptions['readAsset'], fromWeb: boolean): DesignResourceFetch {
  return async (url, signal) => {
    if (fromWeb && (url.startsWith('file:') || url.startsWith(ASSET_BASE_URL))) return null
    if (url.startsWith(ASSET_BASE_URL)) return readAssetAt(url, readAsset)
    if (url.startsWith('file:')) return readFileAt(url, signal)
    return fetchFromNetwork(url, signal)
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
  await registerFallbackFont(engine)
  // The page's own fonts, from its `@font-face` rules, which its text may name first.
  const pageFamilies = new Map<string, string>()
  const baseURL = options.baseURL ?? (options.readAsset ? ASSET_BASE_URL : undefined)
  const fetchResource = pageResourceFetch(pageFetch(options.readAsset, isWebPage(baseURL)))
  const runtime = createHTMLEngineRuntime({
    engine: async () => engine,
    baseURL,
    fetch: fetchResource,
    onFontFace: async (face) => {
      await registerPageFontFace(face)
      pageFamilies.set(face.family.toLowerCase(), face.family)
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
  const graph = await sceneGraphFromStyledHTML(styled, {
    pageName: options.pageName,
    matchIcon: options.matchIcon,
    pageWindow: options.framed ? (options.viewport ?? HTML_IMPORT_VIEWPORT) : undefined
  })
  return { styled, graph }
}

/**
 * Reads HTML files where the HTML engine can load, as in the CLI and the MCP server. It does not
 * match inline SVG to icons by how it draws, so opening a page asks no icon service; SVG the page
 * names with `data-icon` is still that icon. `readHTMLDocument` with a matcher matches, as
 * `openpencil import` passes one.
 */
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

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
 * The most one stylesheet, font, or image may hold, and the most a page's resources may hold
 * together, so a page that links a huge file cannot exhaust the importer's memory.
 */
const MAX_RESOURCE_BYTES = 64 * 1024 * 1024
const MAX_PAGE_BYTES = 256 * 1024 * 1024

/** A response's body, or null once it runs past `MAX_RESOURCE_BYTES`. */
async function boundedBody(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array()
  if (Number(response.headers.get('content-length')) > MAX_RESOURCE_BYTES) {
    await response.body.cancel()
    return null
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    length += read.value.byteLength
    if (length > MAX_RESOURCE_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(read.value)
  }
  const body = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    body.set(chunk, at)
    at += chunk.byteLength
  }
  return body
}

async function readAssetAt(
  url: string,
  readAsset: ReadHTMLOptions['readAsset']
): Promise<HTMLEngineResource | null> {
  try {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
    const bytes = await readAsset?.(path)
    return bytes && bytes.byteLength <= MAX_RESOURCE_BYTES ? resource(url, bytes) : null
  } catch {
    // A malformed escape in the URL, or a host that could not read the file.
    return null
  }
}

async function readFileAt(url: string, signal: AbortSignal): Promise<HTMLEngineResource | null> {
  const { readFile, stat } = await import(/* @vite-ignore */ 'node:fs/promises')
  const info = await stat(new URL(url)).catch(() => null)
  if (!info?.isFile() || info.size > MAX_RESOURCE_BYTES) return null
  const bytes = await readFile(new URL(url), { signal }).catch(() => null)
  return bytes ? resource(url, bytes) : null
}

/**
 * Fetches what a page asks for: its own files through `readAsset`, `file:` URLs from disk, and
 * the rest, such as `https:` and `data:`, over the network, each up to `MAX_RESOURCE_BYTES`.
 */
function pageFetch(readAsset: ReadHTMLOptions['readAsset']): HTMLEngineFetch {
  return async (url, signal) => {
    if (url.startsWith(ASSET_BASE_URL)) return readAssetAt(url, readAsset)
    if (url.startsWith('file:')) return readFileAt(url, signal)
    const response = await fetch(url, { signal }).catch(() => null)
    if (!response?.ok) return null
    const body = await boundedBody(response).catch(() => null)
    const contentType = response.headers.get('content-type') ?? undefined
    return body ? resource(response.url || url, body, contentType) : null
  }
}

/**
 * A fetch that answers each URL it has answered before from the same response, so a page styled
 * twice gets the same stylesheets and fonts both times, whatever the network does in between, and
 * that holds the page's resources to `MAX_PAGE_BYTES` together.
 */
function rememberingFetch(fetch: HTMLEngineFetch): HTMLEngineFetch {
  const answered = new Map<string, HTMLEngineResource>()
  let total = 0
  return async (url, signal) => {
    const known = answered.get(url)
    if (known) return known
    const fetched = await fetch(url, signal)
    // Past the page's total, a resource is left out as one that failed to load.
    if (!fetched || total + fetched.bytes.byteLength > MAX_PAGE_BYTES) return null
    total += fetched.bytes.byteLength
    answered.set(url, fetched)
    return fetched
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
  const pageFamilies = new Map<string, string>()
  const runtime = createHTMLEngineRuntime({
    engine: async () => engine,
    baseURL: options.baseURL ?? (options.readAsset ? ASSET_BASE_URL : undefined),
    fetch: rememberingFetch(pageFetch(options.readAsset)),
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

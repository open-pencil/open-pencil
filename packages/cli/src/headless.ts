import { readFileSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { BUILTIN_IO_FORMATS, IORegistry, initCanvasKit } from '@open-pencil/core/io'
import { populateAllFigPages, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { headlessHTMLReader } from '@open-pencil/core/io/formats/html/import'
import { computeAllLayouts, installTextMeasurer } from '@open-pencil/core/layout'
import { isDocumentAssetName } from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { printError } from '#cli/format'

export { initCanvasKit }

/** The document formats the CLI reads and writes, with HTML read by the headless CSS runtime. */
export const CLI_IO_FORMATS = [...BUILTIN_IO_FORMATS, headlessHTMLReader]

const io = new IORegistry(CLI_IO_FORMATS)

/** Bounds one asset, so a document cannot load an arbitrarily large file into memory. */
const MAX_ASSET_BYTES = 32 * 1024 * 1024

/**
 * Reads an asset a document references relative to itself. A `.pen` document names its images
 * that way, so opening one from disk is the only way its fills get pixels. A name that leaves the
 * document's folder is not an asset and is skipped, as is one that is not a regular file or is
 * larger than the bound; an asset that cannot be read is reported and left out, because one
 * unreadable image must not fail the document.
 */
function documentAssetResolver(filePath: string): (assetPath: string) => Uint8Array | undefined {
  const base = dirname(resolve(filePath))
  return (assetPath) => {
    if (!isDocumentAssetName(assetPath)) return undefined
    const path = resolve(base, assetPath)
    const info = statSync(path, { throwIfNoEntry: false })
    if (!info?.isFile() || info.size > MAX_ASSET_BYTES) return undefined
    try {
      return new Uint8Array(readFileSync(path))
    } catch (error) {
      console.warn(`[pen] Could not read the image "${assetPath}"`, error)
      return undefined
    }
  }
}

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const bytes = new Uint8Array(await readFile(filePath))
  const { graph } = await io.readDocument(
    { name: filePath, data: bytes },
    { resolveAsset: documentAssetResolver(filePath) }
  )
  graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
  return graph
}

let textMeasurer: Promise<void> | null = null

/**
 * Measure text a script or tool lays out with CanvasKit and the fonts it loads, as the app
 * does, instead of the estimate that knows neither line breaks nor wrapping. The document as
 * loaded keeps the layout its file gives it; only edits made afterwards are measured.
 */
export function measureTextHeadlessly(): Promise<void> {
  textMeasurer ??= (async () => {
    const ck = await initCanvasKit()
    const surface = ck.MakeSurface(1, 1)
    if (!surface) throw new Error('CanvasKit could not make a surface to measure text')
    const renderer = new SkiaRenderer(ck, surface)
    await renderer.loadFonts()
    installTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
  })().catch((error: unknown) => {
    textMeasurer = null
    throw error
  })
  return textMeasurer
}

/** `--write` and `--output` for commands that change a headless document. */
export const documentWriteOptions = {
  write: { type: 'boolean', alias: 'w', description: 'Write changes back to the input file' },
  output: { type: 'string', alias: 'o', description: 'Write to a different file', required: false }
} as const

/** Save a headless document as `.fig`, as `eval --write` and `diff apply --write` do. */
export async function writeFigDocument(graph: SceneGraph, filePath: string): Promise<void> {
  const result = await io.writeDocument('fig', graph)
  await writeFile(filePath, result.data as Uint8Array)
}

export function populateDocumentPage(graph: SceneGraph, pageId: string): boolean {
  const changed = populateFigPage(graph, pageId)
  if (changed) graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, pageId))
  return changed
}

export function populateWholeDocument(graph: SceneGraph): boolean {
  const changed = populateAllFigPages(graph)
  if (changed) graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
  return changed
}

/** A string argument of an RPC command, such as its `page` or `format`. */
function stringArg(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return undefined
  const value: unknown = Reflect.get(args, key)
  return typeof value === 'string' ? value : undefined
}

function populateRequestedPage(graph: SceneGraph, pageName?: string): void {
  const pages = graph.getPages()
  const page = pageName ? pages.find((candidate) => candidate.name === pageName) : pages[0]
  if (page) populateDocumentPage(graph, page.id)
}

export function prepareDocumentForRPC(graph: SceneGraph, command: string, args?: unknown): void {
  if (command === 'pages' || command === 'variables') return
  // A stylesheet holds only variables, which load with the document; pages can take minutes.
  if (command === 'tokens' && stringArg(args, 'format') !== 'dtcg') return
  if (command === 'tree') {
    populateRequestedPage(graph, stringArg(args, 'page'))
    return
  }
  if (command === 'find' || command === 'query') {
    const pageName = stringArg(args, 'page')
    if (pageName) populateRequestedPage(graph, pageName)
    else populateWholeDocument(graph)
    return
  }
  populateWholeDocument(graph)
}

export function requirePage(graph: SceneGraph, pageName?: string) {
  const pages = graph.getPages()
  const page = pageName ? pages.find((p) => p.name === pageName) : pages[0]
  if (!page) {
    const available = pages.map((p) => `"${p.name}"`).join(', ')
    printError(
      pageName
        ? `Page "${pageName}" not found. Available pages: ${available || 'none'}.`
        : 'Document has no pages.'
    )
    process.exit(1)
  }
  return page
}

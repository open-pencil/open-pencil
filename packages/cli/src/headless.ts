import { readFile, realpath } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { populateAllFigPages, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { headlessHTMLReader } from '@open-pencil/core/io/formats/html/import'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import {
  computeAllLayouts,
  installTextMeasurer,
  sizeAutoResizingText
} from '@open-pencil/core/layout'
import { writeFileAtomic } from '@open-pencil/core/node/fs'
import { prepareGraphFonts, type DocumentFontStatus } from '@open-pencil/core/text'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { collectSceneMutation } from '@open-pencil/scene-graph/mutation-impact'

import { printError } from '#cli/format'

export { initCanvasKit }

/** The document formats the CLI reads and writes, with HTML read by the headless CSS runtime. */
export const CLI_IO_FORMATS = [...BUILTIN_IO_FORMATS, headlessHTMLReader]

const io = new IORegistry(CLI_IO_FORMATS)

/**
 * Reads a file a document names relative to itself, only from the document's folder: a path that
 * leaves it, through `..` or a link, reads nothing.
 */
function documentAssetReader(filePath: string) {
  return async (path: string): Promise<Uint8Array | null> => {
    const folder = await realpath(dirname(filePath))
    const target = await realpath(resolve(folder, path)).catch(() => null)
    if (!target?.startsWith(folder + sep)) return null
    return new Uint8Array(await readFile(target))
  }
}

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const bytes = new Uint8Array(await readFile(filePath))
  // A format laid out as it is read places its layers by their text's size, which is measured
  // as an export draws it rather than estimated.
  if (io.findReader(filePath)?.laysOutOnRead) await measureTextHeadlessly()
  const { graph } = await io.readDocument({
    name: filePath,
    data: bytes,
    readAsset: documentAssetReader(filePath)
  })
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

/**
 * Measures the text an edit to `graph` lays out as `measureTextHeadlessly` does, in the fonts the
 * document uses: a weight or family the measurer does not start with is otherwise measured in a
 * stand-in, and the edited layer comes out taller or wider than the app draws it. Returns which
 * of those fonts could not be loaded.
 */
export async function measureDocumentText(graph: SceneGraph): Promise<DocumentFontStatus> {
  await measureTextHeadlessly()
  return prepareGraphFonts(
    graph,
    graph.getPages(true).map((page) => page.id)
  )
}

/** `--write` and `--output` for commands that change a headless document. */
export const documentWriteOptions = {
  write: { type: 'boolean', alias: 'w', description: 'Write changes back to the input file' },
  output: { type: 'string', alias: 'o', description: 'Write to a different file', required: false }
} as const

/** Save a headless document as `.fig`, with the thumbnail `export --format fig` renders. */
export async function writeFigDocument(graph: SceneGraph, filePath: string): Promise<void> {
  const result = await io.writeDocument('fig', graph, { renderThumbnail: true })
  await writeFileAtomic(filePath, result.data, { symlink: 'follow' })
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

/**
 * Runs `edit` on `graph`, then loads the fonts the text it touched needs and sizes that text again
 * in them. Text is sized as it is edited, before the fonts for new characters (Japanese in a
 * Latin-only web font, say) can load, so without this it would save the size and glyphs of a
 * stand-in.
 */
export async function editDocument<T>(graph: SceneGraph, edit: () => T | Promise<T>): Promise<T> {
  const { result, impact } = await collectSceneMutation(graph, edit)
  const textIds = [...impact.changedNodeIds].filter((id) => graph.getNode(id)?.type === 'TEXT')
  if (textIds.length === 0) return result
  await prepareGraphFonts(graph, textIds)
  for (const id of textIds) sizeAutoResizingText(graph, id)
  return result
}

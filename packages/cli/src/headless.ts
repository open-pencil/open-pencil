import { readFile, writeFile } from 'node:fs/promises'

import { BUILTIN_IO_FORMATS, IORegistry, initCanvasKit } from '@open-pencil/core/io'
import { populateAllFigPages, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { printError } from '#cli/format'

export { initCanvasKit }

const io = new IORegistry(BUILTIN_IO_FORMATS)

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const bytes = new Uint8Array(await readFile(filePath))
  const { graph } = await io.readDocument({ name: filePath, data: bytes })
  computeAllLayouts(graph)
  return graph
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
  if (changed) computeAllLayouts(graph, pageId)
  return changed
}

export function populateWholeDocument(graph: SceneGraph): boolean {
  const changed = populateAllFigPages(graph)
  if (changed) computeAllLayouts(graph)
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

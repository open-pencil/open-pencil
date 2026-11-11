import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { pendingFigPageOfNode } from '@open-pencil/core/io/formats/fig'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes
} from '@open-pencil/core/io/formats/raster'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { isAppMode, requireFile, rpc } from '#cli/app/client'
import { appPageTargetRPCArgs, requestedPage, type PageCLIArgs } from '#cli/app/target'
import {
  editDocument,
  loadDocument,
  loadDocumentPage,
  measureDocumentText,
  measureTextHeadlessly,
  populateDocumentPage,
  populateWholeDocument,
  requirePage
} from '#cli/headless'

/**
 * A Figma API over a headless document, with CanvasKit raster export and pixel decoding, and
 * the renderer that measures text measuring geometry, booleans, and flatten too. A page not
 * loaded yet loads with its fonts when the script asks for it, as in Figma's dynamic-page mode.
 */
export async function createHeadlessFigma(graph: SceneGraph): Promise<FigmaAPI> {
  const figma = new FigmaAPI(graph, {
    loadPage: (id) => loadDocumentPage(graph, id),
    pageOfNode: (id) => pendingFigPageOfNode(graph, id)
  })
  const renderer = await measureTextHeadlessly()
  // The process's one renderer keeps paths by layer id, which another document's layers share.
  renderer.nodePaths.clear()
  renderer.invalidateAllPictures()
  figma.setRenderer(renderer)
  figma.exportImage = (nodeIds, options) =>
    headlessRenderNodes(graph, options.pageId ?? figma.currentPageId, nodeIds, options)
  figma.rasterCodec = createCanvasKitRasterCodec(await getCanvasKit())
  return figma
}

/**
 * Opens a document file for a script or a tool with every page loaded, or with only the page
 * `--page` or `--page-id` names, which then is the current page; the script loads the others as it
 * asks for them.
 */
export async function openHeadlessFigma(
  file: string,
  pageArgs: PageCLIArgs = {}
): Promise<{ graph: SceneGraph; figma: FigmaAPI }> {
  const requested = requestedPage(pageArgs)
  const graph = await loadDocument(file)
  const pageId = requested ? requirePage(graph, requested).id : undefined
  if (pageId) populateDocumentPage(graph, pageId)
  else populateWholeDocument(graph)
  await measureDocumentText(graph)
  const figma = await createHeadlessFigma(graph)
  if (pageId) figma.currentPage = figma.wrapNode(pageId)
  return { graph, figma }
}

/**
 * Run a Core tool against the running app, or headlessly against a document file, on the page
 * `--page` or `--page-id` names, which in a file is then the only page loaded. Headless runs
 * return the loaded graph so mutating commands can write it back.
 */
export async function runToolData(
  file: string | undefined,
  name: string,
  args: Record<string, unknown>,
  targetArgs: PageCLIArgs = {}
): Promise<{ result: unknown; graph: SceneGraph | null }> {
  if (isAppMode(file)) {
    const target = await appPageTargetRPCArgs(targetArgs)
    return { result: await rpc('tool', { ...target, name, args }), graph: null }
  }
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  const { graph, figma } = await openHeadlessFigma(requireFile(file), targetArgs)
  await tool.loadFonts(figma, args)
  return { result: await editDocument(graph, () => tool.execute(figma, args)), graph }
}

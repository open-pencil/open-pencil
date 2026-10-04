import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { isAppMode, requireFile, rpc } from '#cli/app-client'
import { appTargetRPCArgs, type AppTargetCLIArgs } from '#cli/app-target'
import { loadDocument, populateWholeDocument } from '#cli/headless'

/** A Figma API over a headless document, with CanvasKit raster export and pixel decoding. */
export async function createHeadlessFigma(graph: SceneGraph): Promise<FigmaAPI> {
  const figma = new FigmaAPI(graph)
  figma.exportImage = (nodeIds, options) =>
    headlessRenderNodes(graph, options.pageId ?? figma.currentPageId, nodeIds, options)
  figma.rasterCodec = createCanvasKitRasterCodec(await initCanvasKit())
  return figma
}

/**
 * Run a Core tool against the running app, or headlessly against a document file.
 * Headless runs return the loaded graph so mutating commands can write it back.
 */
export async function runToolData(
  file: string | undefined,
  name: string,
  args: Record<string, unknown>,
  targetArgs?: AppTargetCLIArgs
): Promise<{ result: unknown; graph: SceneGraph | null }> {
  if (isAppMode(file)) {
    const target = targetArgs ? appTargetRPCArgs(targetArgs) : {}
    return { result: await rpc('tool', { ...target, name, args }), graph: null }
  }
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  const graph = await loadDocument(requireFile(file))
  populateWholeDocument(graph)
  const figma = await createHeadlessFigma(graph)
  return { result: await tool.execute(figma, args), graph }
}

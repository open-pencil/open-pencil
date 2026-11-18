import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'
import { withTextInkMeasurer } from '#core/text/ink'

import { renderNodesToImage, renderThumbnail, type ExportFormat } from './render'

let cachedRenderer: Promise<SkiaRenderer> | null = null
/** The headless export holding the renderer, which the next one waits for. */
let exporting: Promise<unknown> = Promise.resolve()

/**
 * The one headless renderer a process keeps, fonts loaded: every renderer registers its own font
 * provider, which holds a copy of each font loaded after it, so a second one doubles that memory.
 * It keeps paths by layer id, which another document's layers share, so a caller measuring a
 * different document clears `nodePaths` and calls `invalidateAllPictures()` first, as
 * `headlessRenderNodes` does.
 */
export async function headlessRenderer(): Promise<SkiaRenderer> {
  return (await getRenderer()).renderer
}

async function getRenderer(): Promise<{ ck: CanvasKit; renderer: SkiaRenderer }> {
  const ck = await getCanvasKit()
  // Callers that arrive together share one renderer rather than each making their own.
  cachedRenderer ??= createRenderer(ck).catch((error: unknown) => {
    cachedRenderer = null
    throw error
  })
  return { ck, renderer: await cachedRenderer }
}

async function createRenderer(ck: CanvasKit): Promise<SkiaRenderer> {
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1
  renderer.viewportHeight = 1
  renderer.dpr = 1
  await renderer.loadFonts()
  return renderer
}

/**
 * Runs `job` with the headless renderer to itself, after the exports before it finish, and clear
 * of what they drew: the renderer keeps paths and pictures by layer id, which layers of another
 * document can share, such as two copies read from one file. An export that prepared or drew
 * while another one did could draw that one's shapes.
 */
export function withHeadlessExport<T>(
  job: (renderer: SkiaRenderer, ck: CanvasKit) => Promise<T>
): Promise<T> {
  const run = exporting.then(async () => {
    const { ck, renderer } = await getRenderer()
    renderer.nodePaths.clear()
    renderer.invalidateAllPictures()
    return job(renderer, ck)
  })
  exporting = run.catch(() => undefined)
  return run
}

export async function headlessRenderNodes(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: {
    scale?: number
    format?: ExportFormat
    quality?: number
    trimTransparent?: boolean
    useAbsoluteBounds?: boolean
  } = {}
): Promise<Uint8Array<ArrayBuffer> | null> {
  return withHeadlessExport(async (renderer, ck) => {
    await renderer.prepareForExport(graph, pageId, nodeIds)
    // An export takes a text by its ink, as Figma's do.
    return withTextInkMeasurer(
      (node) => renderer.measureTextInk(node),
      () =>
        renderNodesToImage(ck, renderer, graph, pageId, nodeIds, {
          scale: options.scale ?? 1,
          format: options.format ?? 'PNG',
          quality: options.quality,
          trimTransparent: options.trimTransparent,
          useAbsoluteBounds: options.useAbsoluteBounds
        })
    )
  })
}

export async function headlessRenderThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  return withHeadlessExport(async (renderer, ck) => {
    await renderer.prepareForExport(graph, pageId, graph.getNode(pageId)?.childIds ?? [])
    return withTextInkMeasurer(
      (node) => renderer.measureTextInk(node),
      () => renderThumbnail(ck, renderer, graph, pageId, width, height)
    )
  })
}

import { SkiaRenderer } from '@open-pencil/core/renderer'

import { renderNodesToImage, renderThumbnail, type ExportFormat } from './render'

import type { SceneGraph } from '@open-pencil/core/scene-graph'
import type { CanvasKit } from 'canvaskit-wasm'

let cachedCk: CanvasKit | null = null
let cachedRenderer: SkiaRenderer | null = null

export async function initCanvasKit(): Promise<CanvasKit> {
  if (cachedCk) return cachedCk
  const CanvasKitInit = (await import('canvaskit-wasm/full')).default
  const ckPath = import.meta.resolve('canvaskit-wasm/full')
  const binDir = new URL('.', ckPath).pathname
  cachedCk = await CanvasKitInit({ locateFile: (file: string) => binDir + file })
  return cachedCk
}

async function getRenderer(): Promise<{ ck: CanvasKit; renderer: SkiaRenderer }> {
  const ck = await initCanvasKit()
  if (cachedRenderer) return { ck, renderer: cachedRenderer }
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1
  renderer.viewportHeight = 1
  renderer.dpr = 1
  await renderer.loadFonts()
  cachedRenderer = renderer
  return { ck, renderer }
}

export async function headlessRenderNodes(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: { scale?: number; format?: ExportFormat; quality?: number } = {}
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  renderer.invalidateAllPictures()
  const restoreTextMeasurer = await renderer.prepareForExport(graph, pageId, nodeIds)
  try {
    return renderNodesToImage(ck, renderer, graph, pageId, nodeIds, {
      scale: options.scale ?? 1,
      format: options.format ?? 'PNG',
      quality: options.quality
    })
  } finally {
    restoreTextMeasurer()
  }
}

export async function headlessRenderThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  renderer.invalidateAllPictures()
  const page = graph.getNode(pageId)
  const restoreTextMeasurer = page
    ? await renderer.prepareForExport(graph, pageId, page.childIds)
    : () => undefined
  try {
    return renderThumbnail(ck, renderer, graph, pageId, width, height)
  } finally {
    restoreTextMeasurer()
  }
}

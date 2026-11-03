import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'

import { renderNodesToImage, renderThumbnail, type ExportFormat } from './render'

let cachedCk: CanvasKit | null = null
let cachedRenderer: Promise<SkiaRenderer> | null = null

export async function initCanvasKit(): Promise<CanvasKit> {
  if (cachedCk) return cachedCk
  const CanvasKitInit = (await import('canvaskit-wasm/full')).default
  const ckURL = import.meta.resolve('canvaskit-wasm/full')
  cachedCk = await CanvasKitInit({
    locateFile: (file: string) => new URL(file, ckURL).href
  })
  return cachedCk
}

/**
 * The one headless renderer a process keeps, fonts loaded: every renderer registers its own font
 * provider, which holds a copy of each font loaded after it, so a second one doubles that memory.
 */
export async function headlessRenderer(): Promise<SkiaRenderer> {
  return (await getRenderer()).renderer
}

async function getRenderer(): Promise<{ ck: CanvasKit; renderer: SkiaRenderer }> {
  const ck = await initCanvasKit()
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
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  // One renderer serves every document: paths keyed by layer id must not outlive theirs.
  renderer.nodePaths.clear()
  renderer.invalidateAllPictures()
  await renderer.prepareForExport(graph, pageId, nodeIds)
  return renderNodesToImage(ck, renderer, graph, pageId, nodeIds, {
    scale: options.scale ?? 1,
    format: options.format ?? 'PNG',
    quality: options.quality,
    trimTransparent: options.trimTransparent,
    useAbsoluteBounds: options.useAbsoluteBounds
  })
}

export async function headlessRenderThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  // One renderer serves every document: paths keyed by layer id must not outlive theirs.
  renderer.nodePaths.clear()
  renderer.invalidateAllPictures()
  await renderer.prepareForExport(graph, pageId, graph.getNode(pageId)?.childIds ?? [])
  return renderThumbnail(ck, renderer, graph, pageId, width, height)
}

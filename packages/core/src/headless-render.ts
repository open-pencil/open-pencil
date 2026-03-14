import type { CanvasKit } from 'canvaskit-wasm'

import { collectFontKeys, loadFont } from './fonts'
import { computeAllLayouts, setTextMeasurer } from './layout'
import { renderNodesToImage, renderThumbnail, type ExportFormat } from './render-image'
import { SkiaRenderer } from './renderer'
import type { SceneGraph } from './scene-graph'

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
  setTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
  cachedRenderer = renderer
  return { ck, renderer }
}

async function loadNodeFonts(graph: SceneGraph, nodeIds: string[]): Promise<void> {
  const fontKeys = collectFontKeys(graph, nodeIds)
  await Promise.all(fontKeys.map(([family, style]) => loadFont(family, style)))
}

export async function headlessRenderNodes(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: { scale?: number; format?: ExportFormat; quality?: number } = {}
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  await loadNodeFonts(graph, nodeIds)
  computeAllLayouts(graph, pageId)
  return renderNodesToImage(ck, renderer, graph, pageId, nodeIds, {
    scale: options.scale ?? 1,
    format: options.format ?? 'PNG',
    quality: options.quality
  })
}

export async function headlessRenderThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  const page = graph.getNode(pageId)
  if (page) await loadNodeFonts(graph, page.childIds)
  computeAllLayouts(graph, pageId)
  return renderThumbnail(ck, renderer, graph, pageId, width, height)
}

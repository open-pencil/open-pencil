import type { CanvasKit } from 'canvaskit-wasm'

import { readStoredPageColor } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'
import { CANVAS_BG_COLOR, IS_BROWSER } from '#core/constants'

import { renderNodesToImage, renderThumbnail, type ExportFormat } from './render'

let cachedCk: CanvasKit | null = null
let cachedRenderer: SkiaRenderer | null = null

export async function initCanvasKit(): Promise<CanvasKit> {
  if (cachedCk) return cachedCk
  // Browser builds already ship and initialize the app's root CanvasKit package.
  // `canvaskit-wasm/full` is a Node/headless entrypoint and remains a bare module
  // specifier under Vite, so resolving it there fails before an import can finish.
  if (IS_BROWSER) {
    cachedCk = await getCanvasKit()
    return cachedCk
  }
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
  options: {
    scale?: number
    format?: ExportFormat
    quality?: number
    trimTransparent?: boolean
  } = {}
): Promise<Uint8Array | null> {
  const { ck, renderer } = await getRenderer()
  renderer.invalidateAllPictures()
  const restoreTextMeasurer = await renderer.prepareForExport(graph, pageId, nodeIds)
  try {
    return renderNodesToImage(ck, renderer, graph, pageId, nodeIds, {
      scale: options.scale ?? 1,
      format: options.format ?? 'PNG',
      quality: options.quality,
      trimTransparent: options.trimTransparent
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
  // The cached renderer never sees editor state, so hand it the document's own
  // stage colour — without this every fallback thumbnail renders on the
  // default grey no matter what page colour the user chose. Always assign:
  // the renderer is reused across documents, so a colourless page must reset it.
  renderer.pageColor = readStoredPageColor(graph, pageId) ?? { ...CANVAS_BG_COLOR }
  return renderThumbnail(ck, renderer, graph, pageId, width, height)
}

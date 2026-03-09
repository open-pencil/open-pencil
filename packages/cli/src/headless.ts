import CanvasKitInit from 'canvaskit-wasm/full'
import type { CanvasKit } from 'canvaskit-wasm'
import {
  parseFigFile,
  type SceneGraph,
  type ExportFormat,
  SkiaRenderer,
  computeAllLayouts,
  loadFont,
  renderNodesToImage,
  renderThumbnail
} from '@open-pencil/core'

let ck: CanvasKit | null = null

export async function initCanvasKit(): Promise<CanvasKit> {
  if (ck) return ck
  const ckPath = import.meta.resolve('canvaskit-wasm/full')
  const binDir = new URL('.', ckPath).pathname
  ck = await CanvasKitInit({
    locateFile: (file) => binDir + file
  })
  return ck
}

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const data = await Bun.file(filePath).arrayBuffer()
  const graph = await parseFigFile(data)
  computeAllLayouts(graph)
  return graph
}

export async function loadFonts(graph: SceneGraph): Promise<void> {
  const families = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (node.fontFamily) families.add(node.fontFamily)
  }
  for (const family of families) {
    await loadFont(family)
  }
}

function createRenderer(ckInstance: CanvasKit, width: number, height: number): SkiaRenderer {
  const surface = ckInstance.MakeSurface(width, height)!
  const renderer = new SkiaRenderer(ckInstance, surface)
  renderer.viewportWidth = width
  renderer.viewportHeight = height
  renderer.dpr = 1
  return renderer
}

export async function exportNodes(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: { scale?: number; format?: ExportFormat; quality?: number }
): Promise<Uint8Array | null> {
  const ckInstance = await initCanvasKit()
  const renderer = createRenderer(ckInstance, 1, 1)
  return renderNodesToImage(ckInstance, renderer, graph, pageId, nodeIds, {
    scale: options.scale ?? 1,
    format: options.format ?? 'PNG',
    quality: options.quality
  })
}

export async function exportThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  const ckInstance = await initCanvasKit()
  const renderer = createRenderer(ckInstance, width, height)
  return renderThumbnail(ckInstance, renderer, graph, pageId, width, height)
}

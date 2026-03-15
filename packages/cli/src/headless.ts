import {
  parseDesignFile,
  initCanvasKit,
  type SceneGraph,
  type ExportFormat,
  computeAllLayouts,
  headlessRenderNodes,
  headlessRenderThumbnail
} from '@open-pencil/core'

export { initCanvasKit }

export async function loadDocument(filePath: string): Promise<SceneGraph> {
  const data = await Bun.file(filePath).arrayBuffer()
  const filename = filePath.split('/').pop() ?? filePath
  const graph = await parseDesignFile(data, filename)
  computeAllLayouts(graph)
  return graph
}

export async function exportNodes(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: { scale?: number; format?: ExportFormat; quality?: number }
): Promise<Uint8Array | null> {
  return headlessRenderNodes(graph, pageId, nodeIds, options)
}

export async function exportThumbnail(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  return headlessRenderThumbnail(graph, pageId, width, height)
}

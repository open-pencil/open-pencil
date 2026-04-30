import { selectionToJSX, sceneNodeToJSX, type RasterExportFormat } from '@open-pencil/core/io'

import type { EditorStore } from '@/app/editor/active-store'

export async function handleExport(store: EditorStore, args: unknown): Promise<unknown> {
  const exportArgs = args as { nodeIds?: string[]; scale?: number; format?: string } | undefined
  const nodeIds = exportArgs?.nodeIds ?? [...store.state.selectedIds]
  if (nodeIds.length === 0) throw new Error('No nodes to export')
  const data = await store.renderExportImage(
    nodeIds,
    exportArgs?.scale ?? 1,
    (exportArgs?.format ?? 'PNG') as RasterExportFormat
  )
  if (!data) throw new Error('Export failed')
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  return {
    ok: true,
    result: { base64, mimeType: `image/${(exportArgs?.format ?? 'png').toLowerCase()}` }
  }
}

export async function handleExportJsx(store: EditorStore, args: unknown): Promise<unknown> {
  const jsxArgs = args as { nodeIds?: string[]; style?: string } | undefined
  const style = (jsxArgs?.style ?? 'openpencil') as 'openpencil' | 'tailwind'
  const currentPage = store.graph.getNode(store.state.currentPageId)
  const nodeIds = jsxArgs?.nodeIds ?? currentPage?.childIds ?? []
  const jsx =
    nodeIds.length === 1
      ? sceneNodeToJSX(nodeIds[0], store.graph, style)
      : selectionToJSX(nodeIds, store.graph, style)
  return { ok: true, result: { jsx } }
}

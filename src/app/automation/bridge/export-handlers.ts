import { fromUint8Array } from 'js-base64'

import { selectionToJSX, type RasterExportFormat } from '@open-pencil/core/io'
import { sceneNodesToTailwindJSX } from '@open-pencil/dom-css/export'

import type { AutomationTarget } from '@/app/automation/bridge/target'

export async function handleExport(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const exportArgs = args as { nodeIds?: string[]; scale?: number; format?: string } | undefined
  const nodeIds = exportArgs?.nodeIds ?? [...store.state.selectedIds]
  if (nodeIds.length === 0) throw new Error('No nodes to export')
  const data = await store.renderExportImage(
    nodeIds,
    exportArgs?.scale ?? 1,
    (exportArgs?.format ?? 'PNG') as RasterExportFormat
  )
  if (!data) throw new Error('Export failed')
  const base64 = fromUint8Array(data)
  return {
    ok: true,
    result: { base64, mimeType: `image/${(exportArgs?.format ?? 'png').toLowerCase()}` }
  }
}

export async function handleExportJSX(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const jsxArgs = args as { nodeIds?: string[]; style?: string } | undefined
  const currentPage = store.graph.getNode(target.pageId)
  const nodeIds = jsxArgs?.nodeIds ?? currentPage?.childIds ?? []
  const jsx =
    jsxArgs?.style === 'tailwind'
      ? sceneNodesToTailwindJSX(store.graph, nodeIds)
      : selectionToJSX(nodeIds, store.graph)
  return { ok: true, result: { jsx } }
}

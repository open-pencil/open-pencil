import { fromUint8Array } from 'js-base64'

import type { RasterExportFormat } from '@open-pencil/core/io'
import { selectionToJSX } from '@open-pencil/design-jsx'
import { sceneNodesToTailwindJSX } from '@open-pencil/dom-css/export'

import type { AutomationTarget } from '@/app/automation/bridge/target'

type ExportArgs = { nodeIds?: string[]; scope?: 'page'; scale?: number; format?: string }

/** The requested layers, every layer of the target page for a page export, or the selection. */
function exportNodeIds(target: AutomationTarget, args: ExportArgs | undefined): string[] {
  const store = target.store
  if (args?.nodeIds) return args.nodeIds
  if (args?.scope !== 'page') return [...store.state.selectedIds]
  return store.graph.getChildren(target.pageId).map((node) => node.id)
}

export async function handleExport(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const exportArgs = args as ExportArgs | undefined
  const nodeIds = exportNodeIds(target, exportArgs)
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

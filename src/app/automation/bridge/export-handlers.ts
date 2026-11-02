import { fromUint8Array } from 'js-base64'

import type { RasterExportFormat } from '@open-pencil/core/io/formats/raster'
import { selectionToJSX } from '@open-pencil/design-jsx'
import { sceneNodesToTailwindJSX } from '@open-pencil/dom-css/export'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import type { EditorStore } from '@/app/editor/active-store'

/**
 * Raster exports draw with the document's canvas renderer, which exists only once its canvas
 * has created a WebGL surface; without one, say so instead of returning an empty image.
 */
export function renderAutomationImage(
  store: EditorStore,
  nodeIds: string[],
  scale: number,
  format: RasterExportFormat,
  pageId?: string
): Promise<Uint8Array | null> {
  if (!store.renderer) {
    throw new Error(
      'This document has no canvas renderer, so it cannot be exported as an image: its canvas has not started or could not create a WebGL surface'
    )
  }
  return store.renderExportImage(nodeIds, scale, format, pageId)
}

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
  const data = await renderAutomationImage(
    store,
    nodeIds,
    exportArgs?.scale ?? 1,
    (exportArgs?.format ?? 'PNG') as RasterExportFormat
  )
  if (!data) throw new Error('The renderer returned no image for these layers')
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

import { encodeBase64 } from '@open-pencil/core/bytes'
import { selectionToJSX, sceneNodeToJSX, type RasterExportFormat } from '@open-pencil/core/io'

import type { AutomationTarget } from '@/app/automation/bridge/target'

type ActivateDocument = (documentId: string) => void

type ExportPresentationTarget = {
  documentId: string
  pageId: string
  store: {
    state: { currentPageId: string }
    graph: { getChildren(parentId: string): { id: string }[] }
    switchPage(pageId: string): Promise<void>
    select(ids: string[]): void
    zoomToSelection(): void
  }
}

function exportNodeIds(
  target: ExportPresentationTarget,
  toolArgs: Record<string, unknown>
): string[] {
  const requestedIds = toolArgs.ids
  if (Array.isArray(requestedIds) && requestedIds.length > 0) {
    return requestedIds.filter((id): id is string => typeof id === 'string')
  }
  return target.store.graph.getChildren(target.pageId).map((node) => node.id)
}

function waitForCanvasRender(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve()
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export async function presentExportImageTarget(
  target: ExportPresentationTarget,
  toolArgs: Record<string, unknown>,
  activateDocument: ActivateDocument
): Promise<void> {
  activateDocument(target.documentId)

  const { store } = target
  if (store.state.currentPageId !== target.pageId) await store.switchPage(target.pageId)

  store.select(exportNodeIds(target, toolArgs))
  store.zoomToSelection()
  await waitForCanvasRender()
}

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
  const base64 = encodeBase64(data)
  return {
    ok: true,
    result: { base64, mimeType: `image/${(exportArgs?.format ?? 'png').toLowerCase()}` }
  }
}

export async function handleExportJSX(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const jsxArgs = args as { nodeIds?: string[]; style?: string } | undefined
  const style = (jsxArgs?.style ?? 'openpencil') as 'openpencil' | 'tailwind'
  const currentPage = store.graph.getNode(target.pageId)
  const nodeIds = jsxArgs?.nodeIds ?? currentPage?.childIds ?? []
  const jsx =
    nodeIds.length === 1
      ? sceneNodeToJSX(nodeIds[0], store.graph, style)
      : selectionToJSX(nodeIds, store.graph, style)
  return { ok: true, result: { jsx } }
}

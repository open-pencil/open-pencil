import type { AutomationTarget } from '@/app/automation/bridge/target'
import { getActiveTabId, switchTab } from '@/app/tabs'

function hasStringId(value: unknown): value is { id: string } {
  return Boolean(
    value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
  )
}

function requestedNodeIDs(args: Record<string, unknown>, result: unknown): string[] {
  if (Array.isArray(args.ids)) return args.ids.filter((id): id is string => typeof id === 'string')
  if (typeof args.id === 'string') return [args.id]
  if (hasStringId(result)) return [result.id]
  return []
}

function pageID(target: AutomationTarget, toolName: string, result: unknown): string {
  if (toolName === 'switch_page' && hasStringId(result)) return result.id
  return target.pageId
}

function belongsToPage(target: AutomationTarget, id: string, expectedPageID: string): boolean {
  let node = target.store.graph.getNode(id)
  while (node) {
    if (node.type === 'CANVAS') return node.id === expectedPageID
    node = node.parentId ? target.store.graph.getNode(node.parentId) : undefined
  }
  return false
}

/** Keep the visible editor aligned with the document context used by an MCP tool. */
export async function followAgentActivity(
  target: AutomationTarget,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown
): Promise<void> {
  const store = target.store
  if (getActiveTabId() !== target.documentId) switchTab(target.documentId)
  const activePageID = pageID(target, toolName, result)
  if (store.state.currentPageId !== activePageID) await store.switchPage(activePageID)

  const nodeIDs = requestedNodeIDs(args, result).filter((id) =>
    belongsToPage(target, id, activePageID)
  )
  if (nodeIDs.length > 0) {
    store.select(nodeIDs)
    store.zoomToSelection()
    return
  }

  store.clearSelection()
  store.zoomToFit()
}
